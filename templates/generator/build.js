const fs = require('fs');
const { build, slotsSeen } = require('./lib');
const all = [...require('./resolutions'), ...require('./supplements'), ...require('./subscriptions')];
const out = process.argv[2] || 'out';
fs.mkdirSync(out, { recursive: true });
(async () => {
  for (const t of all) {
    const f = await build(t.meta, t.body, out);
    console.log('built', f);
  }
  const slots = {};
  for (const [k, v] of [...slotsSeen.entries()].sort()) slots[k] = [...v].sort();
  fs.writeFileSync(out + '/_slots.json', JSON.stringify(slots, null, 1));
  console.log(Object.keys(slots).length, 'slots');
})();
