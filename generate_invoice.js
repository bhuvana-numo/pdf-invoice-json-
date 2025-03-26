const fs = require("fs");
const PdfPrinter = require("pdfmake");


const fonts = {
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold"
  }
};

const printer = new PdfPrinter(fonts);


const templatePath = "invoice_template.json"; 
const jsonData = fs.readFileSync(templatePath, "utf8");
let docDefinition = JSON.parse(jsonData);


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
  connectorType: "Type 2"
};


function replacePlaceholders(obj, data) {
  if (typeof obj === "string") {
    return obj.replace(/{{(.*?)}}/g, (_, key) => data[key.trim()] || "");
  } else if (Array.isArray(obj)) {
    return obj.map((item) => replacePlaceholders(item, data));
  } else if (typeof obj === "object" && obj !== null) {
    const newObj = {};
    for (const key in obj) {
      newObj[key] = replacePlaceholders(obj[key], data);
    }
    return newObj;
  }
  return obj;
}


docDefinition = replacePlaceholders(docDefinition, data);

t
docDefinition.defaultStyle = { font: "Helvetica" };

const pdfDoc = printer.createPdfKitDocument(docDefinition);
pdfDoc.pipe(fs.createWriteStream("invoice.pdf"));
pdfDoc.end();

console.log("Invoice PDF generated successfully as 'invoice.pdf'");
