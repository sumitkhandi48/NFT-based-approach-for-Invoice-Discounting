
import os
import random
from datetime import datetime, timedelta
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

OUT_DIR = "sample_invoices"
os.makedirs(OUT_DIR, exist_ok=True)

styles = getSampleStyleSheet()
title_style = styles["Heading1"]
title_style.alignment = TA_CENTER
normal = styles["BodyText"]

suppliers = [
    ("Northstar Components LLP","44 Electronics Estate, Bengaluru","29AAKFN5678G1Z2"),
    ("Vertex Industrial Pvt. Ltd.","12 Peenya, Bengaluru","29AACCV7890L1Z9"),
]

buyers = [
    ("Orion MedTech Pvt. Ltd.","31 Bannerghatta Rd, Bengaluru","29AAACO3344Q1Z7"),
    ("Nova Manufacturing Ltd.","Whitefield, Bengaluru","29AACCN1122D1Z5"),
]

products = [
    "Medical Equipment","Industrial Sensors","Steel Components",
    "Networking Devices","Electronic Components","Office Furniture",
    "Diagnostic Kits","Control Panels"
]

targets = [1.2,1.8,2.4,2.6,3.1,4.0]

def make_invoice(idx,total_eth):
    supplier = random.choice(suppliers)
    buyer = random.choice(buyers)

    filename = os.path.join(OUT_DIR,f"invoice_{idx}.pdf")
    doc = SimpleDocTemplate(filename)

    elems = []
    elems.append(Paragraph("<b>INVOICE</b>",title_style))
    elems.append(Spacer(1,0.15*inch))

    info = Table([
        ["Supplier", supplier[0], "Buyer", buyer[0]],
        ["Address", supplier[1], "Address", buyer[1]],
        ["GSTIN", supplier[2], "GSTIN", buyer[2]],
        ["Invoice No", f"INV-2026-{idx:04d}", "Invoice Date",
         datetime.now().strftime("%d-%m-%Y")],
        ["Due Date",
         (datetime.now()+timedelta(days=30)).strftime("%d-%m-%Y"),
         "Payment Terms","Net 30"]
    ], colWidths=[1.2*inch,2.3*inch,1.2*inch,2.3*inch])

    info.setStyle(TableStyle([
        ('GRID',(0,0),(-1,-1),0.5,colors.grey),
        ('BACKGROUND',(0,0),(-1,0),colors.HexColor("#DCE6F1")),
        ('BACKGROUND',(0,2),(-1,2),colors.HexColor("#F5F5F5")),
        ('FONTNAME',(0,0),(-1,-1),'Helvetica'),
        ('BOTTOMPADDING',(0,0),(-1,-1),6)
    ]))
    elems.append(info)
    elems.append(Spacer(1,0.2*inch))

    rows=[["Description","Qty","Unit Price (ETH)","Amount (ETH)"]]
    subtotal=0
    for _ in range(random.randint(4,6)):
        qty=random.randint(2,10)
        amt=round(random.uniform(0.15,0.45),3)
        subtotal+=amt
        rows.append([
            random.choice(products),
            qty,
            f"{amt/qty:.4f}",
            f"{amt:.3f}"
        ])

    gst=round(total_eth-subtotal,3)
    if gst<0:
        gst=round(subtotal*0.18,3)
        total=round(subtotal+gst,3)
    else:
        total=total_eth

    table=Table(rows,colWidths=[3.5*inch,0.7*inch,1.2*inch,1.2*inch])
    table.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),colors.HexColor("#1F4E78")),
        ('TEXTCOLOR',(0,0),(-1,0),colors.white),
        ('GRID',(0,0),(-1,-1),0.5,colors.grey),
        ('BACKGROUND',(0,1),(-1,-1),colors.beige),
        ('ALIGN',(1,1),(-1,-1),'CENTER'),
        ('BOTTOMPADDING',(0,0),(-1,0),8)
    ]))
    elems.append(table)
    elems.append(Spacer(1,0.2*inch))

    summary=Table([
        ["Subtotal",f"{subtotal:.3f} ETH"],
        ["GST (18%)",f"{gst:.3f} ETH"],
        ["Grand Total",f"{total:.1f} ETH"],
    ],colWidths=[2.5*inch,1.5*inch])

    summary.setStyle(TableStyle([
        ('GRID',(0,0),(-1,-1),0.5,colors.grey),
        ('BACKGROUND',(0,2),(-1,2),colors.HexColor("#DCE6F1")),
        ('FONTNAME',(0,2),(-1,2),'Helvetica-Bold')
    ]))
    elems.append(summary)
    elems.append(Spacer(1,0.2*inch))

    payment=Paragraph("""
    <b>Payment Details</b><br/>
    Bank: ICICI Bank<br/>
    Account: 601200987655<br/>
    IFSC: ICIC0005678<br/>
    UPI: supplier@upi
    """,normal)
    elems.append(payment)
    elems.append(Spacer(1,0.2*inch))

    footer=Paragraph(
        "<b>Thank you for your business!</b><br/>"
        "This invoice was generated for a Blockchain Invoice Discounting demo.",
        normal)
    elems.append(footer)

    doc.build(elems)

for i,t in enumerate(targets,1):
    make_invoice(i,t)

print("Generated invoices in:",OUT_DIR)
