// sync.js (Revised with content redistribution and fixed clickable links)
require("dotenv").config();
const { Client } = require("@notionhq/client");
const admin = require("firebase-admin");
const fs = require("fs");

admin.initializeApp({
  credential: admin.credential.cert(require("./theranjana-portfolio-firebase-adminsdk-fbsvc-e46e9045f5.json")),
  databaseURL: process.env.FIREBASE_DB_URL
});

const db = admin.database();
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const PAGE_ID = process.env.NOTION_PAGE_ID;

const createText = (content, options = {}) => ({
  type: "text",
  text: { content },
  annotations: {
    bold: options.bold || false,
    italic: options.italic || false,
    color: options.color || "default"
  }
});

function createHeading(text, level = 2) {
  return {
    object: "block",
    type: `heading_${level}`,
    [`heading_${level}`]: {
      rich_text: [
        {
          type: "text",
          text: { content: text },
          annotations: { color: "blue", bold: true }
        }
      ]
    }
  };
}

const createParagraph = (textArray) => ({
  object: "block",
  type: "paragraph",
  paragraph: {
    rich_text: Array.isArray(textArray) ? textArray : [createText(textArray)]
  }
});

const createBullet = contentArr => ({
  object: "block",
  type: "bulleted_list_item",
  bulleted_list_item: {
    rich_text: contentArr
  }
});

const createImageBlock = url => ({
  object: "block",
  type: "image",
  image: {
    type: "external",
    external: { url }
  }
});

const createToggle = (title, children = []) => ({
  object: "block",
  type: "toggle",
  toggle: {
    rich_text: [createText(title, { bold: true })],
    children: children
  }
});

async function updateNotion(data) {
  const blocks = [];

  if (data.bio) {
    // blocks.push(createHeading(`👨‍💻 ${data.bio.name} | ${data.bio.position}`, 1)); // Commented out to avoid duplication

    // Create a minimal left column with just the image
    const leftCol = [createImageBlock(data.bio.profile_picture)];

    // Move ALL content to the right column
    const rightCol = [];

    // Add contact section
    rightCol.push(createHeading("📫 Contact & Channels", 2));

    // Contact items with proper clickable links
    const contactItems = [
      createBullet([
        createText("Email | "),
        {
          type: "text",
          text: {
            content: data.bio.email,
            link: { url: `mailto:${data.bio.email}` }
          },
          annotations: { color: "blue", bold: true }
        }
      ]),
      createBullet([
        createText("GitHub | "),
        {
          type: "text",
          text: {
            content: data.bio.github,
            link: { url: data.bio.github }
          },
          annotations: { color: "blue", bold: true }
        }
      ])
    ];

    if (data.bio.linkedIn) {
      contactItems.push(createBullet([
        createText("LinkedIn | "),
        {
          type: "text",
          text: {
            content: data.bio.linkedIn,
            link: { url: data.bio.linkedIn }
          },
          annotations: { color: "blue", bold: true }
        }
      ]));
    }

    if (data.bio.portfolio) {
      contactItems.push(createBullet([
        createText("Portfolio | "),
        {
          type: "text",
          text: {
            content: data.bio.portfolio,
            link: { url: data.bio.portfolio }
          },
          annotations: { color: "blue", bold: true }
        }
      ]));
    }

    if (data.bio.my_apps) {
      contactItems.push(createBullet([
        createText("My Apps | "),
        {
          type: "text",
          text: {
            content: data.bio.my_apps,
            link: { url: data.bio.my_apps }
          },
          annotations: { color: "blue", bold: true }
        }
      ]));
    }

    // Add contact items to right column
    rightCol.push(...contactItems);

    // Add a small spacer
    rightCol.push(createParagraph(""));

    // Add stacks section right after contact info
    if (data.stacks) {
      rightCol.push(createHeading("🛠 Stacks", 2));

      // Convert stacks to compact format
      for (const [stackName, items] of Object.entries(data.stacks)) {
        rightCol.push(createBullet([
          createText(`${stackName}: `, { bold: true }),
          createText(items.join(", "), { bold: true })
        ]));
      }
    }

    // Create the two-column layout with minimal left content and maximum right content
    blocks.push({
      object: "block",
      type: "column_list",
      column_list: {
        children: [
          {
            object: "block",
            type: "column",
            column: {
              children: leftCol
            }
          },
          {
            object: "block",
            type: "column",
            column: {
              children: rightCol
            }
          }
        ]
      }
    });

    // Add a spacer after the bio/contact/stacks section
    blocks.push({ object: "block", type: "paragraph", paragraph: { rich_text: [] } });
  }

  if (data.experiences) {
    blocks.push(createHeading("📌 Experience", 2));
    blocks.push({ object: "block", type: "divider", divider: {} });

    for (const exp of Object.values(data.experiences)) {
      if (exp.isDeleted) continue;

      // CHANGE 1: Move more content to the left column, only achievements on the right
      const leftCol = [
        createParagraph([
          createText(`${exp.designation} @ ${exp.employer}`, { bold: true })
        ]),
        createParagraph([
          createText(exp.location, { color: "gray", bold: true })
        ]),
        createParagraph([
          createText(exp.period, { italic: true, bold: true })
        ])
      ];

      // Only achievements go in the right column
      const rightCol = [];

      if (exp.achievements) {
        exp.achievements.split("\n").forEach(line => {
          const trimmed = line.trim();
          if (trimmed) {
            rightCol.push({
              object: "block",
              type: "bulleted_list_item",
              bulleted_list_item: {
                rich_text: [createText(trimmed.replace(/^➣/, "").trim(), { bold: true })]
              }
            });
          }
        });
      }

      blocks.push({
        object: "block",
        type: "column_list",
        column_list: {
          children: [
            {
              object: "block",
              type: "column",
              column: { children: leftCol }
            },
            {
              object: "block",
              type: "column",
              column: { children: rightCol }
            }
          ]
        }
      });

      blocks.push({ object: "block", type: "divider", divider: {} });
    }

    blocks.push({ object: "block", type: "paragraph", paragraph: { rich_text: [] } });
  }

  if (data.projects) {
    blocks.push(createHeading("💻 Projects", 2));
    blocks.push({ object: "block", type: "divider", divider: {} });

    for (const project of Object.values(data.projects)) {
      if (project.isDeleted) continue;

      // CHANGE 2: Move more content to the left column, leave only description and techs on the right
      const leftCol = [
        createParagraph([
          createText(`${project.title}`, { bold: true })
        ])
      ];

      // Add date to left column
      if (project.publishedOn) {
        leftCol.push(createParagraph([
          createText(project.publishedOn, { italic: true, bold: true })
        ]));
      }

      // Add all links to left column
      if (project.frontendSourceCodeLink) {
        leftCol.push(createParagraph([
          createText("🔗 Frontend Source Code: ", { bold: true }),
          {
            type: "text",
            text: {
              content: project.frontendSourceCodeLink,
              link: { url: project.frontendSourceCodeLink }
            },
            annotations: { color: "blue", bold: true }
          }
        ]));
      }

      if (project.backendSourceCodeLink) {
        leftCol.push(createParagraph([
          createText("🔗 Backend Source Code: ", { bold: true }),
          {
            type: "text",
            text: {
              content: project.backendSourceCodeLink,
              link: { url: project.backendSourceCodeLink }
            },
            annotations: { color: "blue", bold: true }
          }
        ]));
      }

      if (project.projectLink) {
        leftCol.push(createParagraph([
          createText("🔗 Project Link: ", { bold: true }),
          {
            type: "text",
            text: {
              content: project.projectLink,
              link: { url: project.projectLink }
            },
            annotations: { color: "blue", bold: true }
          }
        ]));
      }

      // Right column will have only description and tech stack
      const rightCol = [];

      // Description lines
      project.description?.split("\n").forEach(line => {
        if (line.trim()) {
          rightCol.push({
            object: "block",
            type: "bulleted_list_item",
            bulleted_list_item: {
              rich_text: [createText(line.trim(), { bold: true })]
            }
          });
        }
      });

      if (project.techs) {
        rightCol.push({
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: [createText(`🛠 Tech Stack: ${project.techs}`, { italic: true, bold: true })]
          }
        });
      }

      blocks.push({
        object: "block",
        type: "column_list",
        column_list: {
          children: [
            {
              object: "block",
              type: "column",
              column: { children: leftCol }
            },
            {
              object: "block",
              type: "column",
              column: { children: rightCol }
            }
          ]
        }
      });

      blocks.push({ object: "block", type: "divider", divider: {} });
    }

    blocks.push({ object: "block", type: "paragraph", paragraph: { rich_text: [] } }); // spacer
  }

  if (data.education) {
    blocks.push(createHeading("🎓 Education", 2));
    blocks.push({ object: "block", type: "divider", divider: {} });

    // CHANGE 3: Update education section to include course and rearrange content
    const leftCol = [];

    // Add course first if it exists
    if (data.education.course) {
      leftCol.push(createParagraph([
        createText(data.education.course, { bold: true })
      ]));
    }

    // Then add school
    leftCol.push(createParagraph([
      createText(data.education.school, { bold: true })
    ]));

    // Then add duration
    leftCol.push(createParagraph([
      createText(data.education.duration, { italic: true, bold: true })
    ]));

    // Only majors on the right column
    const rightCol = data.education.majors.map(subject => ({
      object: "block",
      type: "bulleted_list_item",
      bulleted_list_item: {
        rich_text: [createText(subject, { bold: true })]
      }
    }));

    blocks.push({
      object: "block",
      type: "column_list",
      column_list: {
        children: [
          {
            object: "block",
            type: "column",
            column: { children: leftCol }
          },
          {
            object: "block",
            type: "column",
            column: { children: rightCol }
          }
        ]
      }
    });

    blocks.push({ object: "block", type: "paragraph", paragraph: { rich_text: [] } });
  }

  // Add certifications section
  if (data.certifications) {
    blocks.push(createHeading("🏆 Certifications", 2));
    blocks.push({ object: "block", type: "divider", divider: {} });

    for (const cert of Object.values(data.certifications)) {
      if (cert.isDeleted) continue;

      const certBlock = {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            createText("• ", { bold: true }),  // Added big dot before each certification
            createText(`${cert.title} - ${cert.issuingOrganization} (${cert.issueDate})`, { bold: true })
          ]
        }
      };

      if (cert.showCredentialsLink) {
        certBlock.paragraph.rich_text.push(
            createText(" | "),
            {
              type: "text",
              text: {
                content: "View Credential",
                link: { url: cert.showCredentialsLink }
              },
              annotations: { color: "blue", bold: true }
            }
        );
      }

      blocks.push(certBlock);
    }

    blocks.push({ object: "block", type: "paragraph", paragraph: { rich_text: [] } });
  }

  const existing = await notion.blocks.children.list({ block_id: PAGE_ID });
  for (const block of existing.results) {
    await notion.blocks.delete({ block_id: block.id }).catch(() => {});
  }

  await notion.blocks.children.append({
    block_id: PAGE_ID,
    children: blocks
  });

  console.log("✅ Notion resume updated.");
}

async function run() {
  console.log("Firebase URL:", process.env.FIREBASE_DB_URL);
  const ref = db.ref("/");
  const snapshot = await ref.once("value");
  const data = snapshot.val();
  if (data) await updateNotion(data);
}

run();