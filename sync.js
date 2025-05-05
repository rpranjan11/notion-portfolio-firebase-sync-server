// sync.js (Final styled version with layout, emojis, and toggles)
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

// Smaller image block (40% smaller)
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
    // blocks.push(createHeading(`👨‍💻 ${data.bio.name} | ${data.bio.position}`, 1));

    // Create contact items for the right column
    const rightColumnChildren = [];

    // Add contact section
    rightColumnChildren.push(createHeading("📫 Contact & Channels", 2));

    // Contact items
    const contactItems = [
      createBullet([createText("Email | "), createText(data.bio.email, { color: "blue", bold: true })]),
      createBullet([createText("GitHub | "), createText(data.bio.github, { color: "blue", bold: true })])
    ];
    if (data.bio.linkedIn) contactItems.push(createBullet([createText("LinkedIn | "), createText(data.bio.linkedIn, { color: "blue", bold: true })]));
    if (data.bio.portfolio) contactItems.push(createBullet([createText("Portfolio | "), createText(data.bio.portfolio, { color: "blue", bold: true })]));
    if (data.bio.my_apps) contactItems.push(createBullet([createText("My Apps | "), createText(data.bio.my_apps, { color: "blue", bold: true })]));

    // Add contact items to right column
    rightColumnChildren.push(...contactItems);

    // Add a small spacer
    rightColumnChildren.push(createParagraph(""));

    // Add stacks section right after contact info
    if (data.stacks) {
      rightColumnChildren.push(createHeading("🛠 Stacks", 2));

      // Convert stacks to compact format
      for (const [stackName, items] of Object.entries(data.stacks)) {
        rightColumnChildren.push(createBullet([
          createText(`${stackName}: `, { bold: true }),
          createText(items.join(", "), { bold: true })
        ]));
      }
    }

    // Create the two-column layout with image on left and content on right
    blocks.push({
      object: "block",
      type: "column_list",
      column_list: {
        children: [
          {
            object: "block",
            type: "column",
            column: {
              children: [
                // We can't directly resize images in Notion API, but we can add a paragraph
                // to make the column narrower, giving the effect of a smaller image
                createParagraph(""),
                createImageBlock(data.bio.profile_picture),
                createParagraph("")
              ]
            }
          },
          {
            object: "block",
            type: "column",
            column: {
              children: rightColumnChildren
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

      // Create columns for experience
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

      const rightCol = [];

      if (exp.notion_achievements) {
        exp.notion_achievements.split("\n").forEach(line => {
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

      if (exp.techs) {
        rightCol.push(createParagraph([
          createText(`🛠 Technologies: ${exp.techs}`, { italic: true, bold: true })
        ]));
      }

      // Use column layout for the experience (not inside toggle)
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

      // Create a block for project outside of toggles
      const leftCol = [
        createParagraph([
          createText(`${project.title}`, { bold: true })
        ])
      ];

      if (project.publishedOn) {
        leftCol.push(createParagraph([
          createText(project.publishedOn, { italic: true, bold: true })
        ]));
      }

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

      const rightCol = [];

      // Description lines
      project.notion_description?.split("\n").forEach(line => {
        if (line.trim()) {
          rightCol.push({
            object: "block",
            type: "bulleted_list_item",
            bulleted_list_item: {
              rich_text: [createText(line.trim(), { bold: true })]  // Make text bold for larger appearance
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

      // Use column layout for the project (not inside toggle)
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

    const leftCol = [
      createParagraph([
        createText(data.education.school, { bold: true })
      ]),
      createParagraph([
        createText(data.education.duration, { italic: true, bold: true })
      ])
    ];

    const rightCol = data.education.majors.map(subject => ({
      object: "block",
      type: "bulleted_list_item",
      bulleted_list_item: {
        rich_text: [createText(subject, { bold: true })]  // Make text bold for larger appearance
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