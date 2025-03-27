const fs = require("fs");
const PdfPrinter = require("pdfmake");
const QRCode = require("qrcode");

// Define fonts for pdfmake
const fonts = {
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold"
  }
};

const printer = new PdfPrinter(fonts);

// Load JSON template
const templatePath = "invoice_template.json";
const jsonData = fs.readFileSync(templatePath, "utf8");
let docDefinition = JSON.parse(jsonData);

// Replaceable data
const data = {
  invoice: "INV-2025001",
  stationAddress: "123 EV Street, Green City",
  stationGSTN: "GST12345678",
  stationPAN: "PAN987654",
  userName: "John Doe",
  userType: "EV Owner",
  vehicleDetails: "Tesla Model 3",
  accountAddress: "456 Charging Lane, Blue Town",
  accountGSTN: "GST87654321",
  accountPAN: "PAN123456",
  createdOn: "2025-03-26",
  stationName: "SuperCharge Station",
  cpid: "CP-7890",
  connectorType: "Type 2",
  logoPath: "logo.png",
  invoiceQR: "INV-2025001" // This will be converted to QR code
};

// Generate QR Code as a Base64 string
async function generateQRCode(text) {
  try {
    return await QRCode.toDataURL(text);
  } catch (err) {
    console.error("Error generating QR Code:", err);
    return "";
  }
}

// Replace placeholders in the document definition
async function replacePlaceholders(obj, data) {
  if (typeof obj === "string") {
    if (obj === "[IMAGE PLACEHOLDER]") {
      return data.logoPath; // Replace with logo image path
    }
    return obj.replace(/{{(.*?)}}/g, (_, key) => data[key.trim()] || "");
  } else if (Array.isArray(obj)) {
    return Promise.all(obj.map(async (item) => await replacePlaceholders(item, data)));
  } else if (typeof obj === "object" && obj !== null) {
    if (obj.qr) {
      obj.qr = await generateQRCode(data.invoiceQR || "N/A"); // Generate QR code dynamically
    }
    const newObj = {};
    for (const key in obj) {
      newObj[key] = await replacePlaceholders(obj[key], data);
    }
    return newObj;
  }
  return obj;
}

// Main function to generate PDF
async function generatePDF() {
  docDefinition = await replacePlaceholders(docDefinition, data);

  // Set default style
  docDefinition.defaultStyle = { font: "Helvetica" };

  // Create and write PDF
  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  pdfDoc.pipe(fs.createWriteStream("invoice.pdf"));
  pdfDoc.end();

  console.log("✅ Invoice PDF generated successfully as 'invoice.pdf'");
}

// Run the PDF generation
generatePDF();
