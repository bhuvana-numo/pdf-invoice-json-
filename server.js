const express = require("express");
const fs = require("fs");
const axios = require("axios");
const PdfPrinter = require("pdfmake");
const QRCode = require("qrcode");
const path = require("path");

const app = express();
const PORT = 3000;

const TEMPLATE_PATH = path.join(__dirname, "invoice_template.json");
const INVOICE_DATA_API_URL = "https://api.jsonbin.io/v3/b/67eed5d78561e97a50f834b0";
const QR_CODE_PATH = path.join(__dirname, "invoiceQR.png");


function getBase64Image(imagePath) {
  if (!fs.existsSync(imagePath)) return "";
  const image = fs.readFileSync(imagePath);
  return `data:image/png;base64,${image.toString("base64")}`;
}

async function generateQRCode(text) {
  if (!text) return;
  await QRCode.toFile(QR_CODE_PATH, text, { width: 150 });
}

async function replacePlaceholders(template, data) {
  if (!data || !data.record) throw new Error("Invalid or empty data received from API.");
  const actualData = data.record;

  // Special dynamic fields (always considered available)
  const dynamicFields = new Set(["invoiceQR", "logo.png"]);

  // Step 1: Find all required (non-dynamic) fields from template
  function getMandatoryFields(node) {
    let fields = new Set();

    if (Array.isArray(node)) {
      node.forEach(item => fields = new Set([...fields, ...getMandatoryFields(item)]));
    } else if (typeof node === "object" && node !== null) {
      if (node._field) return fields; // skip optional field check
      for (const key in node) {
        fields = new Set([...fields, ...getMandatoryFields(node[key])]);
      }
    } else if (typeof node === "string") {
      const matches = node.match(/{{(.*?)}}/g) || [];
      matches.forEach(match => fields.add(match.replace(/{{|}}/g, "").trim()));
    }

    return fields;
  }

  const mandatoryFields = [...getMandatoryFields(template)].filter(field => !dynamicFields.has(field));
  const missingFields = mandatoryFields.filter(field => !(field in actualData));
  if (missingFields.length > 0) {
    throw new Error(`🚨 Missing mandatory fields in API response: ${missingFields.join(", ")}`);
  }

  // Step 2: Generate special fields like QR code and logo
  await generateQRCode(actualData["invoice"]);
  actualData["invoiceQR"] = getBase64Image(QR_CODE_PATH);
  actualData["logo.png"] = getBase64Image(path.join(__dirname, "logo.png"));

  // Step 3: Replace placeholders recursively
  function processTemplate(node) {
    if (Array.isArray(node)) {
      return node
        .map(processTemplate)
        .filter(item => item !== null && item !== undefined);
    } else if (typeof node === "object" && node !== null) {
      // Optional field logic
      if (node._field && !actualData[node._field]) return null;

      // Special handling for 'row' blocks (like table rows)
      if (node.row && Array.isArray(node.row)) {
        return node.row.map(processTemplate);
      }

      // Generic object case
      const newNode = {};
      for (const key in node) {
        if (key !== "_field") {
          newNode[key] = processTemplate(node[key]);
        }
      }
      return newNode;
    } else if (typeof node === "string") {
      return node.replace(/{{(.*?)}}/g, (_, key) => {
        const value = actualData[key.trim()];
        return value !== undefined && value !== null ? value : "N/A";
      });
    }
    return node;
  }

  return processTemplate(template);
}

app.get("/", (req, res) => {
  res.send(`<h2>Go to <a href="/generate-pdf" target="_blank">/generate-pdf</a> to download your invoice PDF</h2>`);
});

app.get("/generate-pdf", async (req, res) => {
  try {
    const templateContent = fs.readFileSync(TEMPLATE_PATH, "utf-8");
    const invoiceTemplate = JSON.parse(templateContent);

    // 👇 Add this part
    invoiceTemplate.background = function (currentPage, pageSize) {
      return {
        canvas: [
          {
            type: 'rect',
            x: 10,
            y: 10,
            w: pageSize.width - 20,
            h: pageSize.height - 20,
            lineWidth: 1
          }
        ]
      };
    };
    const { data: invoiceData } = await axios.get(INVOICE_DATA_API_URL);
    const filledTemplate = await replacePlaceholders(invoiceTemplate, invoiceData);

    const printer = new PdfPrinter({
      Helvetica: {
        normal: "Helvetica",
        bold: "Helvetica-Bold",
      },
    });

    filledTemplate.defaultStyle = { font: "Helvetica" };

    const pdfDoc = printer.createPdfKitDocument(filledTemplate);
    res.setHeader("Content-Type", "application/pdf");
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (err) {
    res.status(500).send("Error generating PDF: " + err.message);
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
