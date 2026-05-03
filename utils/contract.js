/**
 * utils/contract.js — geração e congelamento do contrato.
 *
 * Fluxo:
 *  1. Cliente paga → webhook chama convertSignup()
 *  2. convertSignup() chama signOnConvert():
 *     - monta snapshot HTML do contrato (dados do cliente + plano + ToS + Privacy)
 *     - calcula sha256 do snapshot
 *     - INSERT em contract_signatures (imutável)
 *  3. Email de boas-vindas anexa PDF gerado a partir do snapshot
 *  4. Cliente pode baixar PDF a qualquer momento via /api/contract/:id/pdf
 *  5. Validador externo pode conferir hash via /api/contract/verify/:hash
 *
 * Garantias jurídicas:
 *  - acceptance_id linka aceite com IP/UA/timestamp
 *  - contract_html congelado (não muda mesmo se ToS mudar depois)
 *  - hash sha256 prova integridade do conteúdo
 *  - signed_at + signer_ip + signer_user_agent = cadeia de evidência
 */
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const db = require('../db');
const terms = require('./terms');

function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function fmtBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(d) {
  return new Date(d).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
}

/**
 * Monta o HTML do contrato — snapshot frozen, vai pro DB e pro PDF.
 */
async function buildContractHtml({ signup, plan, acceptance, termsRow, privacyRow, payment_id }) {
  const data = {
    signer_name:  signup.name,
    signer_email: signup.email,
    workspace:    signup.workspace_name,
    phone:        signup.phone || '—',
    plan_name:    plan.name,
    plan_price:   fmtBRL(plan.price_brl),
    payment_id:   payment_id || '—',
    accepted_at:  fmtDate(acceptance.accepted_at),
    accepted_ip:  acceptance.ip || '—',
    accepted_ua:  acceptance.user_agent || '—',
    terms_v:      termsRow.version,
    terms_hash:   termsRow.hash,
    privacy_v:    privacyRow.version,
    privacy_hash: privacyRow.hash,
    contract_n:   `NX-${String(signup.id).padStart(6, '0')}-${new Date().getFullYear()}`,
    contracted_at: fmtDate(new Date()),
  };

  return `<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><title>Contrato ${escHtml(data.contract_n)} — Nexus OS</title></head><body>
<h1>Contrato de Prestação de Serviços de Software</h1>
<p><strong>Nº do Contrato:</strong> ${escHtml(data.contract_n)}<br>
<strong>Data de celebração:</strong> ${escHtml(data.contracted_at)}</p>

<h2>1. Partes</h2>
<p><strong>CONTRATADA:</strong> Nexus OS, plataforma SaaS disponibilizada em https://nexusagencia.app.</p>
<p><strong>CONTRATANTE:</strong></p>
<ul>
  <li>Nome: ${escHtml(data.signer_name)}</li>
  <li>E-mail: ${escHtml(data.signer_email)}</li>
  <li>Telefone: ${escHtml(data.phone)}</li>
  <li>Workspace: ${escHtml(data.workspace)}</li>
</ul>

<h2>2. Objeto e Plano Contratado</h2>
<p>A CONTRATADA disponibiliza à CONTRATANTE acesso à plataforma Nexus OS no plano:</p>
<ul>
  <li><strong>Plano:</strong> ${escHtml(data.plan_name)}</li>
  <li><strong>Valor mensal:</strong> ${escHtml(data.plan_price)}</li>
  <li><strong>Periodicidade:</strong> Mensal, com renovação automática até cancelamento.</li>
  <li><strong>Vigência:</strong> Início imediato após confirmação do pagamento.</li>
</ul>

<h2>3. Pagamento</h2>
<p>O primeiro pagamento foi processado via Mercado Pago, identificador <code>${escHtml(data.payment_id)}</code>. Pagamentos subsequentes serão cobrados na mesma data de cada mês, salvo cancelamento prévio.</p>

<h2>4. Aceite e Cadeia de Evidência</h2>
<p>A CONTRATANTE manifestou aceite eletrônico aos Termos de Uso e à Política de Privacidade da CONTRATADA na forma do art. 10, §2º do Marco Civil da Internet (Lei 12.965/2014), com as seguintes evidências registradas:</p>
<ul>
  <li><strong>Data e hora do aceite:</strong> ${escHtml(data.accepted_at)} (horário de Brasília)</li>
  <li><strong>Endereço IP:</strong> ${escHtml(data.accepted_ip)}</li>
  <li><strong>User-Agent:</strong> ${escHtml(data.accepted_ua)}</li>
  <li><strong>Termos de Uso aceitos:</strong> v${escHtml(data.terms_v)} (hash sha256: <code>${escHtml(data.terms_hash)}</code>)</li>
  <li><strong>Política de Privacidade aceita:</strong> v${escHtml(data.privacy_v)} (hash sha256: <code>${escHtml(data.privacy_hash)}</code>)</li>
</ul>

<h2>5. Termos Aplicáveis</h2>
<p>Aplicam-se a este contrato, integrando-o como anexos inseparáveis:</p>
<ol>
  <li><strong>Termos de Uso v${escHtml(data.terms_v)}</strong>, disponíveis em https://nexusagencia.app/termos</li>
  <li><strong>Política de Privacidade v${escHtml(data.privacy_v)}</strong>, disponível em https://nexusagencia.app/privacidade</li>
</ol>
<p>Os documentos acima foram lidos e aceitos pela CONTRATANTE no ato do aceite eletrônico. Os hashes registrados acima permitem verificar a integridade do conteúdo aceito.</p>

<h2>6. Cancelamento</h2>
<p>A CONTRATANTE poderá cancelar a qualquer momento, sem multa rescisória, conforme cláusula 4 dos Termos de Uso.</p>

<h2>7. Foro</h2>
<p>Fica eleito o foro da comarca da sede da CONTRATADA para dirimir quaisquer controvérsias decorrentes deste contrato.</p>

<hr>
<p style="font-size:11px;color:#666"><em>Este contrato é uma evidência eletrônica gerada automaticamente no momento da contratação. A integridade pode ser verificada através do hash sha256 disponível em https://nexusagencia.app/api/contract/verify/&lt;hash&gt;.</em></p>
</body></html>`;
}

/**
 * Chamado pelo convertSignup quando pagamento é confirmado.
 * Cria registro imutável em contract_signatures.
 */
async function signOnConvert({ signup, workspace_id, user_id, payment_id }) {
  if (!signup.acceptance_id) {
    throw new Error('signup sem acceptance_id — não é possível gerar contrato');
  }

  // Já existe contrato pra esse signup? (idempotência)
  const exists = await db.get(
    `SELECT id, contract_hash FROM contract_signatures WHERE pending_signup_id = $1`,
    [signup.id]
  );
  if (exists) return exists;

  const acceptance = await db.get(
    `SELECT id, email, ip, user_agent, accepted_at, terms_version_id, privacy_version_id
     FROM terms_acceptances WHERE id = $1`, [signup.acceptance_id]
  );
  if (!acceptance) throw new Error('acceptance not found');

  const plan = await db.get(`SELECT id, name, price_brl FROM plans WHERE id = $1`, [signup.plan_id]);
  const termsRow = await terms.getById(acceptance.terms_version_id);
  const privacyRow = await terms.getById(acceptance.privacy_version_id);

  const contract_html = await buildContractHtml({
    signup, plan, acceptance, termsRow, privacyRow, payment_id,
  });

  // Hash combina HTML + dados do aceite — qualquer alteração muda o hash
  const fingerprint = JSON.stringify({
    html_sha: crypto.createHash('sha256').update(contract_html).digest('hex'),
    acceptance_id: acceptance.id,
    ip: acceptance.ip,
    accepted_at: acceptance.accepted_at,
    payment_id,
  });
  const contract_hash = crypto.createHash('sha256').update(fingerprint).digest('hex');

  const row = await db.get(`
    INSERT INTO contract_signatures (
      pending_signup_id, workspace_id, user_id, acceptance_id,
      contract_html, contract_hash,
      signer_name, signer_email, signer_ip, signer_user_agent,
      plan_id, plan_name, plan_price_brl,
      metadata
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    RETURNING id, contract_hash, signed_at
  `, [
    signup.id, workspace_id, user_id, acceptance.id,
    contract_html, contract_hash,
    signup.name, signup.email, acceptance.ip, acceptance.user_agent,
    plan.id, plan.name, plan.price_brl,
    JSON.stringify({ payment_id, terms_v: termsRow.version, privacy_v: privacyRow.version }),
  ]);

  return row;
}

/**
 * Gera PDF a partir do snapshot HTML congelado.
 * Retorna Buffer.
 */
async function renderPdf(signature) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 60 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(20).fillColor('#0099ff').text('NEXUS · OS', { align: 'left' });
    doc.fontSize(9).fillColor('#666').text('Contrato de Prestação de Serviços de Software', { align: 'left' });
    doc.moveDown(1.5);

    // Metadata box
    doc.fontSize(9).fillColor('#444');
    doc.text(`Nº: ${parseFromHtml(signature.contract_html, /Nº do Contrato:[^<]*?<\/strong>\s*([^<\n]+)/) || `NX-${signature.id}`}`);
    doc.text(`Hash de integridade: ${signature.contract_hash}`);
    doc.text(`Assinado eletronicamente em: ${fmtDate(signature.signed_at)}`);
    doc.moveDown(1);

    // Parse HTML to plain sections (simples — split por <h2>)
    const html = signature.contract_html;
    const sections = html.split(/<h2[^>]*>/i).slice(1);
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);

    if (titleMatch) {
      doc.fontSize(14).fillColor('#000').text(stripTags(titleMatch[1]), { align: 'left' });
      doc.moveDown(0.8);
    }

    for (const sec of sections) {
      const titleEnd = sec.indexOf('</h2>');
      if (titleEnd < 0) continue;
      const title = stripTags(sec.slice(0, titleEnd));
      const body = sec.slice(titleEnd + 5);

      doc.fontSize(11).fillColor('#0099ff').text(title);
      doc.moveDown(0.3);
      doc.fontSize(9.5).fillColor('#222');

      // Itens de lista
      const items = [...body.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(m => stripTags(m[1]));
      const paras = body.replace(/<ul[\s\S]*?<\/ul>/gi, '').replace(/<ol[\s\S]*?<\/ol>/gi, '')
        .split(/<\/?p[^>]*>/i).map(s => stripTags(s).trim()).filter(Boolean);

      for (const p of paras) {
        doc.text(p, { align: 'justify' });
        doc.moveDown(0.3);
      }
      for (const it of items) {
        doc.text(`  •  ${it}`, { align: 'left' });
        doc.moveDown(0.15);
      }
      doc.moveDown(0.5);
    }

    // Footer
    doc.moveDown(1);
    doc.fontSize(8).fillColor('#888');
    doc.text('Este documento é uma evidência eletrônica do contrato firmado pela CONTRATANTE no ato do aceite eletrônico aos Termos de Uso e Política de Privacidade do Nexus OS, em conformidade com o art. 10, §2º, da Lei 12.965/2014 (Marco Civil da Internet).', { align: 'justify' });
    doc.moveDown(0.5);
    doc.text(`Verificação de integridade: https://nexusagencia.app/api/contract/verify/${signature.contract_hash}`, { align: 'center' });

    doc.end();
  });
}

function stripTags(s) {
  return String(s).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();
}
function parseFromHtml(html, regex) {
  const m = html.match(regex);
  return m ? stripTags(m[1]) : null;
}

module.exports = { signOnConvert, renderPdf, buildContractHtml };
