const express = require("express");
const fs = require("fs");
const axios = require("axios");
const PdfPrinter = require("pdfmake");
const QRCode = require("qrcode"); 
const path = require("path");

const app = express();
const PORT = 3000;

const TEMPLATE_PATH = path.join(__dirname, "invoice_template.json");
const INVOICE_DATA_API_URL = "https://api.jsonbin.io/v3/qs/67ee892f8561e97a50f8051a";
const QR_CODE_PATH = path.join(__dirname, "invoiceQR.png");

async function generateQRCode(text) {
  try {
    if (!text) throw new Error("QR Code text is missing.");
    await QRCode.toFile(QR_CODE_PATH, text, { width: 150 });
  } catch (error) {
    console.error("Error generating QR Code:", error.message);
  }
}

function getBase64Image(imagePath) {
  try {
    if (!fs.existsSync(imagePath)) {
      console.warn(` Image file not found: ${imagePath}`);
      return "";
    }
    const image = fs.readFileSync(imagePath);
    return `data:image/png;base64,${image.toString("base64")}`;
  } catch (error) {
    console.error("Error loading image:", imagePath, error.message);
    return "";
  }
}

async function replacePlaceholders(template, data) {
  try {
    if (!data || !data.record) throw new Error("Invalid or empty data received.");
    const actualData = data.record;

    if (actualData["invoice"]) {
      await generateQRCode(actualData["invoice"]);
    } else {
      console.warn(" No invoice number found, skipping QR code generation.");
    }

    actualData["invoiceQR"] = getBase64Image(QR_CODE_PATH);
    actualData["logo.png"] = getBase64Image(path.join(__dirname, "logo.png"));

    if (!actualData["invoiceQR"]) {
      console.warn("QR Code missing in PDF.");
    } else {
      console.log("QR Code successfully embedded in PDF.");
    }

    const jsonString = JSON.stringify(template);
    const updatedJsonString = jsonString.replace(/{{(.*?)}}/g, (_, key) => actualData[key.trim()] || "N/A");

    return JSON.parse(updatedJsonString);
  } catch (error) {
    console.error("Error processing placeholders:", error.message);
    throw error;
  }
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
      console.error(" Error fetching invoice data:", error.message);
      return res.status(500).send("Failed to fetch invoice data.");
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
    console.error("🚨 Error generating PDF:", error.message);
    res.status(500).send("Failed to generate PDF.");
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
