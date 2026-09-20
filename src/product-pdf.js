const text=value=>String(value??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[^\x20-\x7E]/g,'?');
const esc=value=>text(value).replace(/([\\()])/g,'\\$1');
function simplePdf(lines=[]){
  const body=lines.slice(0,45).map((line,index)=>`${index?'0 -16 Td ':''}(${esc(line)}) Tj`).join('\n');
  const stream=`BT\n/F1 11 Tf\n50 790 Td\n${body||'(Relatorio sem dados) Tj'}\nET`;
  const objects=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  ];
  let pdf='%PDF-1.4\n',offsets=[0];
  objects.forEach((object,index)=>{offsets.push(pdf.length);pdf+=`${index+1} 0 obj\n${object}\nendobj\n`;});
  const xref=pdf.length;pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(let i=1;i<offsets.length;i++)pdf+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}
export function createCattlePdfService({documents,flags=null}={}){
  return Object.freeze({
    async build(type,{title=null,rows=[]}={}){if(flags&&await flags.enabled('pdf.enabled')===false)throw new Error('PDF feature is disabled.');if(!documents?.definitions?.[type])throw new Error(`Unknown document/report type: ${type}.`);const definition=documents.definitions[type];const columns=definition.columns??[];const lines=[title??definition.title,'',...rows.map(row=>columns.map(column=>`${column}: ${row?.[column]??''}`).join(' | '))];const template={basePdf:new Uint8Array([37,80,68,70]),schemas:[]};const generator=async()=>simplePdf(lines);const result=await documents.buildPdf(type,{template,inputs:rows,generator});return Object.freeze({...result,size:result.content.byteLength});}
  });
}
