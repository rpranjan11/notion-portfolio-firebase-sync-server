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

const createText = (text, link = null, bold = false) => ({
  type: "text",
  text: { content: text, link: link ? { url: link } : null },
  annotations: { bold }
});

const createHeading = (text, level = 2) => ({
  object: "block",
  type: `heading_${level}`,
  [`heading_${level}`]: {
    rich_text: [createText(text)]
  }
});

const createParagraph = text => ({
  object: "block",
  type: "paragraph",
  paragraph: {
    rich_text: [createText(text)]
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
    rich_text: [createText(title, null, true)],
    children: children
  }
});

const createColumnLayout = (imageUrl, contactItems) => ({
  object: "block",
  type: "column_list",
  column_list: {
    children: [
      {
        type: "column",
        column: {
          children: [createImageBlock(imageUrl)]
        }
      },
      {
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
      createBullet([createText("Email | "), createText(data.bio.email, `mailto:${data.bio.email}`)]),
      createBullet([createText("GitHub | "), createText(data.bio.github, data.bio.github)])
    ];
    if (data.bio.linkedIn) contactItems.push(createBullet([createText("LinkedIn | "), createText(data.bio.linkedIn, data.bio.linkedIn)]));
    if (data.bio.twitter) contactItems.push(createBullet([createText("Twitter | "), createText(data.bio.twitter, data.bio.twitter)]));

    blocks.push(createColumnLayout(data.bio.profile_picture, contactItems));
  }

  if (data.stacks) {
    blocks.push(createHeading("🛠 Stacks", 2));
    blocks.push({ object: "block", type: "divider", divider: {} });

    const leftCol = [];
    const rightCol = [];

    for (const category in data.stacks) {
      // Left column: bold label
      leftCol.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: { content: category },
              annotations: {
                bold: true
              }
            }
          ]
        }
      });

      // Right column: bullets
      const items = data.stacks[category].map(item => ({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [createText(item)]
        }
      }));
      rightCol.push(...items);
    }

    blocks.push({
      object: "block",
      type: "column_list",
      column_list: {
        children: [
          {
            type: "column",
            column: {
              children: leftCol
            }
          },
          {
            type: "column",
            column: {
              children: rightCol
            }
          }
        ]
      }
    });

    blocks.push({ object: "block", type: "paragraph", paragraph: { rich_text: [] } }); // spacer
  }

  if (data.projects) {
    blocks.push(createHeading("💻 Projects", 2));
    blocks.push({ object: "block", type: "divider", divider: {} });

    for (const project of Object.values(data.projects)) {
      if (project.isDeleted) continue;

      const leftColumnChildren = [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "text",
                text: { content: `📌 ${project.title}` },
                annotations: { bold: true }
              }
            ]
          }
        }
      ];

      if (project.publishedOn) {
        leftColumnChildren.push({
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "text",
                text: { content: project.publishedOn },
                annotations: { italic: true }
              }
            ]
          }
        });
      }

      const rightColumnChildren = [];

      // Description lines
      project.description?.split("\n").forEach(line => {
        if (line.trim()) {
          rightColumnChildren.push({
            object: "block",
            type: "bulleted_list_item",
            bulleted_list_item: {
              rich_text: [createText(line.trim())]
            }
          });
        }
      });

      if (project.techs) {
        rightColumnChildren.push({
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: [createText(`🛠 Tech Stack: ${project.techs}`)]
          }
        });
      }

      if (project.projectLink) {
        rightColumnChildren.push({
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: [createText("🔗 View", project.projectLink)]
          }
        });
      }

      blocks.push({
        object: "block",
        type: "column_list",
        column_list: {
          children: [
            {
              type: "column",
              column: {
                children: leftColumnChildren
              }
            },
            {
              type: "column",
              column: {
                children: rightColumnChildren
              }
            }
          ]
        }
      });

      blocks.push({ object: "block", type: "paragraph", paragraph: { rich_text: [] } }); // spacer
    }
  }

  if (data.experiences) {
    blocks.push(createHeading("📌 Experiences", 2));
    Object.values(data.experiences).forEach(exp => {
      if (!exp.isDeleted) {
        const children = [
          createParagraph(exp.achievements || "")
        ];
        blocks.push(createToggle(`💼 ${exp.designation} @ ${exp.employer} (${exp.period})`, children));
      }
    });
  }

  if (data.education) {
    blocks.push(createHeading("🎓 Education", 2));
    blocks.push(createBullet([createText(data.education.school)]));
    blocks.push(createBullet([createText(data.education.duration)]));
    data.education.majors.forEach(major => blocks.push(createBullet([createText(major)])));
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