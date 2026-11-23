const assert = require('assert');
const { parseGrid } = require('./watcher');

// Simulacion de la rejilla PrimeFaces con dos tarjetas de vacante
const html = `
<div id="form-busqueda:tabla-vacantes_content" class="ui-datagrid-content ui-widget-content">
  <table><tbody>
    <tr>
      <td class="ui-datagrid-item">
        <div class="vacante-card">
          <b>Vacante 12345</b><br/>
          Secretaría: Bogotá<br/>
          Establecimiento: I.E. Distrital Central<br/>
          Área: Matemáticas<br/>
          Tipo: Vacante General<br/>
          Fecha publicación: 22/11/2026
        </div>
      </td>
      <td class="ui-datagrid-item">
        <div class="vacante-card">
          <b>Vacante 12346</b><br/>
          Secretaría: Medellín<br/>
          Establecimiento: I.E. La Plaza<br/>
          Área: Tecnología e informática<br/>
          Fecha publicación: 22/11/2026
        </div>
      </td>
    </tr>
  </tbody></table>
</div>`;

const cards = parseGrid(html, '');
console.log('Tarjetas extraídas:', cards.length);
cards.forEach((c, i) => console.log(`  ${i + 1}. id=${c.id} | ${c.text}`));
assert.strictEqual(cards.length, 2, 'Debe extraer 2 tarjetas');
assert.strictEqual(cards[0].id, '12345');
assert.strictEqual(cards[1].id, '12346');
assert.ok(/Matemáticas/.test(cards[0].text));
assert.ok(/Tecnología/.test(cards[1].text));

// Fallback a texto plano
const plain = parseGrid('', 'Vacante 99999\nSecretaría: Cali\nÁrea: Matemáticas\n\nVacante 99998\nSecretaría: Pereira\nÁrea: Matemáticas');
console.log('Fallback texto:', plain.length, plain.map(x => x.id));
assert.strictEqual(plain.length, 2);
console.log('OK - parser validado');
