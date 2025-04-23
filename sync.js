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

const createImageBlock = url => ({
  object: "block",
  type: "image",
  image: { type: "external", external: { url } }
});

const createToggle = (title, children = []) => ({
  object: "block",
  type: "toggle",
  toggle: {
    rich_text: [createText(title, { bold: true })],
    children: children
  }
});

const createColumnLayout = (imageUrl, contactItems) => ({
  object: "block",
  type: "column_list",
  column_list: {
    children: [
      {
        object: "block",
        type: "column",
        column: {
          children: [createImageBlock(imageUrl)]
        }
      },
      {
        object: "block",
        type: "column",
        column: {
          children: [
            createHeading("📫 Contact & Channels", 2),
            ...contactItems
          ]
        }
      }
    ]
  }
});

async function updateNotion(data) {
  const blocks = [];

  if (data.bio) {
    blocks.push(createHeading(`👨‍💻 ${data.bio.name} | ${data.bio.position}`, 1));

    const contactItems = [
      createBullet([createText("Email | "), createText(data.bio.email, { color: "blue" })]),
      createBullet([createText("GitHub | "), createText(data.bio.github, { color: "blue" })])
    ];
    if (data.bio.linkedIn) contactItems.push(createBullet([createText("LinkedIn | "), createText(data.bio.linkedIn, { color: "blue" })]));
    if (data.bio.portfolio) contactItems.push(createBullet([createText("Portfolio | "), createText(data.bio.portfolio, { color: "blue" })]));
    if (data.bio.my_apps) contactItems.push(createBullet([createText("My Apps | "), createText(data.bio.my_apps, { color: "blue" })]));
    blocks.push(createColumnLayout(data.bio.profile_picture, contactItems));
  }

  if (data.stacks) {
    blocks.push(createHeading("🛠 Stacks", 2));
    blocks.push({ object: "block", type: "divider", divider: {} });

    const stackBlockPairs = Object.entries(data.stacks).map(([stackName, items]) => {
      const leftLabel = {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: { content: stackName },
              annotations: { bold: true }
            }
          ]
        }
      };

      const rightBullets = items.map(item => ({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [createText(item)]
        }
      }));

      return {
        object: "block",
        type: "column_list",
        column_list: {
          children: [
            {
              object: "block",
              type: "column",
              column: { children: [leftLabel] }
            },
            {
              object: "block",
              type: "column",
              column: { children: rightBullets }
            }
          ]
        }
      };
    });

    blocks.push(...stackBlockPairs);

    blocks.push({ object: "block", type: "paragraph", paragraph: { rich_text: [] } }); // final spacing
  }

  if (data.projects) {
    blocks.push(createHeading("💻 Projects", 2));
    blocks.push({ object: "block", type: "divider", divider: {} });

    for (const project of Object.values(data.projects)) {
      if (project.isDeleted) continue;

      // Instead of using column layout inside toggle, use simple paragraphs and bullets
      const projectChildren = [];

      // Add project title and date
      projectChildren.push(createParagraph([
        createText(`📌 ${project.title}`, { bold: true })
      ]));

      if (project.publishedOn) {
        projectChildren.push(createParagraph([
          createText(project.publishedOn, { italic: true })
        ]));
      }

      // Add links
      if (project.frontendSourceCodeLink) {
        projectChildren.push(createParagraph([
          createText("🔗 Frontend Source Code: ", { bold: true }),
          {
            type: "text",
            text: {
              content: project.frontendSourceCodeLink,
              link: { url: project.frontendSourceCodeLink }
            },
            annotations: { color: "blue" }
          }
        ]));
      }

      if (project.backendSourceCodeLink) {
        projectChildren.push(createParagraph([
          createText("🔗 Backend Source Code: ", { bold: true }),
          {
            type: "text",
            text: {
              content: project.backendSourceCodeLink,
              link: { url: project.backendSourceCodeLink }
            },
            annotations: { color: "blue" }
          }
        ]));
      }

      if (project.projectLink) {
        projectChildren.push(createParagraph([
          createText("🔗 Project Link: ", { bold: true }),
          {
            type: "text",
            text: {
              content: project.projectLink,
              link: { url: project.projectLink }
            },
            annotations: { color: "blue" }
          }
        ]));
      }

      // Add divider
      projectChildren.push({ object: "block", type: "divider", divider: {} });

      // Description lines
      project.description?.split("\n").forEach(line => {
        if (line.trim()) {
          projectChildren.push({
            object: "block",
            type: "bulleted_list_item",
            bulleted_list_item: {
              rich_text: [createText(line.trim())]
            }
          });
        }
      });

      if (project.techs) {
        projectChildren.push({
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: [createText(`🛠 Tech Stack: ${project.techs}`)]
          }
        });
      }

      blocks.push(createToggle(`📌 ${project.title}`, projectChildren));
      blocks.push({ object: "block", type: "paragraph", paragraph: { rich_text: [] } }); // spacer
    }
  }

  if (data.experiences) {
    blocks.push(createHeading("📌 Experience", 2));
    blocks.push({ object: "block", type: "divider", divider: {} });

    for (const exp of Object.values(data.experiences)) {
      if (exp.isDeleted) continue;

      // Similar approach for experiences - use simple blocks inside toggle
      const expChildren = [];

      expChildren.push(createParagraph([
        createText(`${exp.designation} @ ${exp.employer}`, { bold: true })
      ]));

      expChildren.push(createParagraph([
        createText(exp.location, { color: "gray" })
      ]));

      expChildren.push(createParagraph([
        createText(exp.period, { italic: true })
      ]));

      // Add divider between header and achievements
      expChildren.push({ object: "block", type: "divider", divider: {} });

      if (exp.achievements) {
        exp.achievements.split("\n").forEach(line => {
          const trimmed = line.trim();
          if (trimmed) {
            expChildren.push({
              object: "block",
              type: "bulleted_list_item",
              bulleted_list_item: {
                rich_text: [createText(trimmed.replace(/^➣/, "➤"))]
              }
            });
          }
        });
      }

      if (exp.techs) {
        expChildren.push(createParagraph([
          createText(`Technologies: ${exp.techs}`, { italic: true })
        ]));
      }

      blocks.push(createToggle(`${exp.designation} @ ${exp.employer}`, expChildren));
      blocks.push({ object: "block", type: "paragraph", paragraph: { rich_text: [] } });
    }
  }

  if (data.education) {
    blocks.push(createHeading("🎓 Education", 2));
    blocks.push({ object: "block", type: "divider", divider: {} });

    // For education, let's use simple blocks instead of columns
    blocks.push(createParagraph([
      createText(data.education.school, { bold: true })
    ]));

    blocks.push(createParagraph([
      createText(data.education.duration, { italic: true })
    ]));

    blocks.push({ object: "block", type: "divider", divider: {} });

    data.education.majors.forEach(subject => {
      blocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [createText(subject)]
        }
      });
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
              annotations: { color: "blue" }
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