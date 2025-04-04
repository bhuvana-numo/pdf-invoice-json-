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

async function generateQRCode(text) {
  if (!text) throw new Error("QR Code text is missing.");
  await QRCode.toFile(QR_CODE_PATH, text, { width: 150 });
}

function getBase64Image(imagePath) {
  if (!fs.existsSync(imagePath)) return "";
  const image = fs.readFileSync(imagePath);
  return `data:image/png;base64,${image.toString("base64")}`;
}
async function replacePlaceholders(template, data) {
    if (!data || !data.record) throw new Error("Invalid or empty data received from API.");
    const actualData = data.record;
  

    const dynamicFields = new Set(["invoiceQR", "logo.png"]);
  
    
    function getMandatoryFields(node) {
      let fields = new Set();
  
      if (Array.isArray(node)) {
        node.forEach(item => fields = new Set([...fields, ...getMandatoryFields(item)]));
      } else if (typeof node === "object" && node !== null) {
        if (node._field) return fields;
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
  

    await generateQRCode(actualData["invoice"]);
    actualData["invoiceQR"] = getBase64Image(QR_CODE_PATH);
    actualData["logo.png"] = getBase64Image(path.join(__dirname, "logo.png"));
  
    function processTemplate(node) {
      if (Array.isArray(node)) {
        return node.map(processTemplate).filter(item => item !== null && item !== undefined);
      } else if (typeof node === "object" && node !== null) {
        if (node._field && !actualData[node._field]) return null; 
  
        const newNode = {};
        for (const key in node) {
          if (key !== "_field") {
            newNode[key] = processTemplate(node[key]);
          }
        }
        return newNode;
      } else if (typeof node === "string") {
        return node.replace(/{{(.*?)}}/g, (_, key) => actualData[key.trim()] || "N/A");
      }
      return node;
    }
  
    return processTemplate(template);
  }
  
app.get("/", (req, res) => {
  res.send(`
    <h1>Welcome to the Invoice PDF Generator!</h1>
    <p>Click <a href="/generate-pdf" target="_blank">here</a> to generate a PDF.</p>
  `);
});

app.get("/generate-pdf", async (req, res) => {
  try {
    if (!fs.existsSync(TEMPLATE_PATH)) throw new Error("Template file not found.");

    const templateContent = fs.readFileSync(TEMPLATE_PATH, "utf-8");
    const invoiceTemplate = JSON.parse(templateContent);

    let invoiceData;
    try {
      const response = await axios.get(INVOICE_DATA_API_URL);
      invoiceData = response.data;
    } catch (error) {
      return res.status(500).send("Failed to fetch invoice data from API.");
    }

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
  } catch (error) {
    res.status(500).send(`PDF generation failed: ${error.message}`);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
