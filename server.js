const express = require("express");
const fs = require("fs");
const axios = require("axios");
const PdfPrinter = require("pdfmake");
const QRCode = require("qrcode"); 
const path = require("path");

const app = express();
const PORT = 3000;

const TEMPLATE_PATH = path.join(__dirname, "invoice_template.json");
const INVOICE_DATA_API_URL = "https://api.jsonbin.io/v3/qs/67ee5aaf8960c979a57d8480";
const QR_CODE_PATH = path.join(__dirname, "invoiceQR.png");


async function generateQRCode(text) {
  try {
 
    await QRCode.toFile(QR_CODE_PATH, text, { width: 150 });

  } catch (error) {
    console.error("Error generating QR Code:", error.message);
  }
}

function getBase64Image(imagePath) {
  try {
    if (!fs.existsSync(imagePath)) {
      console.warn(`Image file not found: ${imagePath}`);
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
  const actualData = data.record || data;

  if (actualData["invoice"]) {
    
    await generateQRCode(actualData["invoice"]);
  } else {
    console.warn("No invoice number found, skipping QR code generation.");
  }


  actualData["invoiceQR"] = getBase64Image(QR_CODE_PATH);
  actualData["logo.png"] = getBase64Image(path.join(__dirname, "logo.png"));

  
  if (actualData["invoiceQR"]) {
    console.log("QR Code successfully embedded in PDF.");
  } else {
    console.warn(" QR Code missing in PDF.");
  }

  const jsonString = JSON.stringify(template);
  const updatedJsonString = jsonString.replace(/{{(.*?)}}/g, (_, key) => actualData[key.trim()] || "");

  return JSON.parse(updatedJsonString);
}

app.get("/", (req, res) => {
  res.send(`
    <h1>Welcome to the Invoice PDF Generator!</h1>
    <p>Click <a href="/generate-pdf" target="_blank">here</a> to generate a PDF.</p>
  `);
});

app.get("/generate-pdf", async (req, res) => {
  try {
    const templateContent = fs.readFileSync(TEMPLATE_PATH, "utf-8");
    const invoiceTemplate = JSON.parse(templateContent);

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

  } catch (error) {
    console.error("🚨 Error generating PDF:", error.message);
    res.status(500).send("Failed to generate PDF");
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
