const express = require("express"); 
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const PdfPrinter = require("pdfmake");
const QRCode = require("qrcode");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

const fonts = {
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
};

const printer = new PdfPrinter(fonts);

async function generateQR(text) {
  try {
    return await QRCode.toDataURL(text);
  } catch (err) {
    console.error("Error generating QR code:", err);
    return null;
  }
}

app.post("/generate", async (req, res) => {
  try {
    const {
      invoice, userName, amount, stationAddress, stationGSTN, stationPAN,
      userType, vehicleDetails, accountAddress, accountGSTN, accountPAN,
      createdOn, stationName, cpid, connectorType
    } = req.body;

    const qrCode = await generateQR(invoice);

    const docDefinition = {
      content: [
        
        {
          table: {
            widths: ["25%", "50%", "25%"], 
            body: [
              [
                { text: "" },
                { image: "public/logo.png", width: 100, alignment: "center" }, 
                qrCode ? { image: qrCode, width: 100, alignment: "right" } : { text: "" }
              ]
            ]
          },
          layout: "noBorders"
        },

        { text: "Invoice", style: "header", alignment: "center", margin: [0, 10, 0, 10] },

        {
          table: {
            widths: ["50%", "50%"],
            body: [
              [{ text: "Invoice Number", alignment: "left" }, { text: invoice, alignment: "right" }],
              [{ text: "Address", alignment: "left" }, { text: stationAddress, alignment: "right" }],
              [{ text: "GST Number", alignment: "left" }, { text: stationGSTN, alignment: "right" }],
              [{ text: "PAN", alignment: "left" }, { text: stationPAN, alignment: "right" }]
            ]
          },
          layout: "noBorders"
        },

        { text: "Bill To", style: "subheader", margin: [0, 10, 0, 5] },

        {
          table: {
            widths: ["50%", "50%"],
            body: [
              [{ text: "Name", alignment: "left" }, { text: userName, alignment: "right" }],
              [{ text: "Additional Information", alignment: "left" }, { text: `${userType} ${vehicleDetails}`, alignment: "right" }],
              [{ text: "Address", alignment: "left" }, { text: accountAddress, alignment: "right" }],
              [{ text: "GST Number", alignment: "left" }, { text: accountGSTN, alignment: "right" }],
              [{ text: "PAN", alignment: "left" }, { text: accountPAN, alignment: "right" }],
              [{ text: "Invoice Date", alignment: "left" }, { text: createdOn, alignment: "right" }],
              [{ text: "Station Name", alignment: "left" }, { text: stationName, alignment: "right" }],
              [{ text: "CPID", alignment: "left" }, { text: cpid, alignment: "right" }],
              [{ text: "Connector Type", alignment: "left" }, { text: connectorType, alignment: "right" }]
            ]
          },
          layout: "noBorders"
        }
      ],
      styles: {
        header: { fontSize: 18, bold: true, font: "Helvetica" },
        subheader: { fontSize: 12, bold: true, font: "Helvetica" },
      },
      defaultStyle: {
        font: "Helvetica",
      },
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const pdfPath = path.join(__dirname, "public", "preview.pdf");
    const writeStream = fs.createWriteStream(pdfPath);
    pdfDoc.pipe(writeStream);
    pdfDoc.end();

    writeStream.on("finish", () => {
      res.redirect("/preview.html");
    });

  } catch (error) {
    console.error("Error during PDF generation:", error);
    res.status(500).send("Error generating PDF");
  }
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
