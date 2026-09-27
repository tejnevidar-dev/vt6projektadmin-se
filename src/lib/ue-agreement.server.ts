/**
 * UE:ns signering av ramavtalet -> subcontractors.agreement_signed_at + arkivering av den
 * signerade PDF:en som ett subcontractor_documents-dokument (doc_type 'avtal'), så den syns i
 * UE-registrets vanliga dokumentlista. Får aldrig kasta: signeringen är redan genomförd.
 *
 * Skriver till "subcontractor-docs"-bucketen (samma som subcontractors-api.ts läser från),
 * inte "offers" där själva signeringsflödet lagrar - kopierar bytes en gång vid signering
 * istället för att göra dokumentlistan bucket-medveten.
 */
export async function markUeAgreementSigned(sb: any, row: any, signedBytes: Uint8Array, signedAt: Date): Promise<void> {
  try {
    if (row.document_type !== "avtal" || !row.subcontractor_id) return;
    const dateStamp = signedAt.toISOString().slice(0, 10);
    const fileName = `ramavtal-signerat-${dateStamp}.pdf`;
    const filePath = `${row.subcontractor_id}/${Date.now()}-${fileName}`;

    const { error: upErr } = await sb.storage
      .from("subcontractor-docs")
      .upload(filePath, signedBytes, { contentType: "application/pdf", upsert: false });
    if (upErr) {
      console.error("markUeAgreementSigned: upload failed:", upErr.message);
      return;
    }

    await sb.from("subcontractor_documents").insert({
      subcontractor_id: row.subcontractor_id,
      doc_type: "avtal",
      file_path: filePath,
      file_name: fileName,
      mime_type: "application/pdf",
      file_size: signedBytes.byteLength,
      uploaded_by: row.created_by ?? null,
    });

    await sb
      .from("subcontractors")
      .update({ agreement_signed_at: signedAt.toISOString().slice(0, 10) })
      .eq("id", row.subcontractor_id)
      .is("agreement_signed_at", null);
  } catch (err) {
    console.error("markUeAgreementSigned failed:", err);
  }
}
