
require("dotenv").config();
const { Client } = require("@notionhq/client");
const admin = require("firebase-admin");
const fs = require("fs");

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(require("./theranjana-portfolio-firebase-adminsdk-fbsvc-e46e9045f5.json")),
  databaseURL: process.env.FIREBASE_DB_URL
});

const db = admin.database();
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const PAGE_ID = process.env.NOTION_PAGE_ID;

function createHeading(text, level = 2) {
  return {
    object: "block",
    type: `heading_${level}`,
    [`heading_${level}`]: {
      rich_text: [{ type: "text", text: { content: text } }]
    }
  };
}

function createParagraph(text) {
  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [{ type: "text", text: { content: text } }]
    }
  };
}

function createBulleted(text) {
  return {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: {
      rich_text: [{ type: "text", text: { content: text } }]
    }
  };
}

function createImageBlock(url) {
  return {
    object: "block",
    type: "image",
    image: {
      type: "external",
      external: { url }
    }
  };
}

async function updateNotion(data) {
  const blocks = [];

  if (data.bio) {
    blocks.push(createHeading("👤 Bio", 2));
    blocks.push(createImageBlock(data.bio.profile_picture));
    blocks.push(createParagraph(`${data.bio.name}, ${data.bio.position}`));
    blocks.push(createParagraph(data.bio.description));
    blocks.push(createParagraph(`📍 ${data.bio.location}`));
    blocks.push(createParagraph(`📧 ${data.bio.email}`));
  }

  if (data.experiences) {
    blocks.push(createHeading("💼 Experience", 2));
    Object.values(data.experiences).forEach(exp => {
      if (!exp.isDeleted) {
        blocks.push(createBulleted(`${exp.designation} at ${exp.employer} (${exp.period})`));
        blocks.push(createParagraph(exp.achievements));
      }
    });
  }

  if (data.projects) {
    blocks.push(createHeading("🧪 Projects", 2));
    Object.values(data.projects).forEach(proj => {
      if (!proj.isDeleted) {
        blocks.push(createBulleted(`${proj.title} (${proj.publishedOn})`));
        blocks.push(createParagraph(proj.description));
        if (proj.projectLink) blocks.push(createParagraph(`🔗 ${proj.projectLink}`));
      }
    });
  }

  if (data.certifications) {
    blocks.push(createHeading("📜 Certifications", 2));
    Object.values(data.certifications).forEach(cert => {
      if (!cert.isDeleted) {
        blocks.push(createBulleted(`${cert.title} – ${cert.issuingOrganization} (${cert.issueDate})`));
        blocks.push(createParagraph(`🎓 Credential ID: ${cert.credentials}`));
        blocks.push(createParagraph(`🔗 ${cert.showCredentialsLink}`));
      }
    });
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
  const ref = db.ref("/");
  const snapshot = await ref.once("value");
  const data = snapshot.val();
  if (data) await updateNotion(data);
}

run();
