// Standalone probe for the Solis inverter — reads firmware versions and the
// registers most likely to explain why forced grid export (43133) is being
// rejected by the inverter.
//
// Usage:
//   node scripts/probe-inverter.js [host] [port] [unitId]
//   node scripts/probe-inverter.js 192.168.1.92 502 1
//
// IMPORTANT: most Solis dataloggers only accept ONE active TCP connection.
// If the Homey app is currently polling, this script will likely fail to
// connect. Temporarily disable the device in Homey (or stop the app) before
// running, then re-enable it after.

const net = require('net');
const Modbus = require('jsmodbus');

const HOST = process.argv[2] || '192.168.1.92';
const PORT = Number(process.argv[3] || 502);
const UNIT_ID = Number(process.argv[4] || 1);

const socket = new net.Socket();
const client = new Modbus.client.TCP(socket, UNIT_ID, 5000);

// What we want to look at, with how to interpret each register.
//
// Firmware ids — confirms whether a firmware update actually happened.
// Power limit registers — most plausible cause of 43133 silently sticking at 0.
// Current export-control state — what the inverter is reporting back right now.
const REGISTERS = [
  { addr: 33000, type: 'INPUT',   name: 'Model No.',                   fmt: 'hex' },
  { addr: 33001, type: 'INPUT',   name: 'DSP Version',                 fmt: 'hex' },
  { addr: 33002, type: 'INPUT',   name: 'HMI Version',                 fmt: 'hex' },
  { addr: 33003, type: 'INPUT',   name: 'Protocol Version',            fmt: 'hex' },
  { addr: 33069, type: 'INPUT',   name: 'HMI Sub Version',             fmt: 'dec' },
  { addr: 35000, type: 'INPUT',   name: 'Model Definition',            fmt: 'hex' },
  { addr: 33095, type: 'INPUT',   name: 'Inverter Status',             fmt: 'hex' },

  // Power-limit / backflow candidates
  { addr: 43050, type: 'HOLDING', name: 'Working Mode Set',            fmt: 'hex',
    note: '0=No Response, 1=Volt-Watt, 2=Volt-Var, 3=Fixed PF, 4=Fixed Q, 5=Power-PF' },
  { addr: 43051, type: 'HOLDING', name: 'Limit Reactive Power',        fmt: 's16', unit: '0.01%' },
  { addr: 43052, type: 'HOLDING', name: 'Limited Power Setting',       fmt: 'u16', unit: '0.01%',
    note: '100% = 10000. If <100%, inverter is capping output.' },
  { addr: 43027, type: 'HOLDING', name: 'Force Charge Limit',          fmt: 'u16', unit: '10W' },
  { addr: 43028, type: 'HOLDING', name: 'Force Charge Source',         fmt: 'u16',
    note: '0=GRID_ONLY, 1=GRID_AND_PV' },
  { addr: 43029, type: 'HOLDING', name: 'Meter CT Direction',          fmt: 'u16',
    note: '0=positive, 1=reverse' },
  { addr: 43073, type: 'HOLDING', name: 'Meter/CT Position',           fmt: 'u16' },
  { addr: 43140, type: 'HOLDING', name: 'Meter Type and Location',     fmt: 'hex',
    note: 'High byte=location, Low byte=type' },

  // Current export-related state
  { addr: 43110, type: 'HOLDING', name: 'Storage Control Mode',        fmt: 'u16',
    note: 'EXPORT/DISCHARGE/IDLE = 257' },
  { addr: 43128, type: 'HOLDING', name: 'Grid Port Active Power (set)', fmt: 's16', unit: '10W' },
  { addr: 43129, type: 'HOLDING', name: 'Force Discharge Power',       fmt: 'u16', unit: '10W' },
  { addr: 43130, type: 'HOLDING', name: 'Battery Charge Limit Power',  fmt: 'u16', unit: '10W' },
  { addr: 43131, type: 'HOLDING', name: 'Battery Discharge Limit Power', fmt: 'u16', unit: '10W' },
  { addr: 43132, type: 'HOLDING', name: 'Grid Adjustment',             fmt: 'u16',
    note: '0=OFF, 1=ON(system→43133), 2=ON(inverter→43128)' },
  { addr: 43133, type: 'HOLDING', name: 'System Point Active Power (set)', fmt: 's16', unit: '10W' },
  { addr: 43135, type: 'HOLDING', name: 'Force Battery Charge/Discharge', fmt: 'u16',
    note: '0=OFF, 1=charge, 2=discharge — must be 0 for export' },
  { addr: 43136, type: 'HOLDING', name: 'Force Charge Power',          fmt: 'u16', unit: '10W' },
  { addr: 43311, type: 'HOLDING', name: 'Passive Mode',                fmt: 'hex',
    note: '0=OFF (required for export), 0xAA55=ON' },
];

function decode(buf, fmt) {
  const u16 = buf.readUInt16BE(0);
  const s16 = buf.readInt16BE(0);
  switch (fmt) {
    case 'hex': return `0x${u16.toString(16).padStart(4, '0').toUpperCase()} (${u16})`;
    case 's16': return String(s16);
    case 'u16':
    case 'dec':
    default:    return String(u16);
  }
}

async function readOne(reg) {
  const op = reg.type === 'INPUT'
    ? client.readInputRegisters(reg.addr, 1)
    : client.readHoldingRegisters(reg.addr, 1);
  try {
    const res = await op;
    const buf = res.response.body.valuesAsBuffer;
    return { ok: true, raw: buf.readUInt16BE(0), display: decode(buf, reg.fmt) };
  } catch (err) {
    const msg = err && err.response
      ? `Modbus exception ${err.response.body.code}`
      : (err && err.message) || String(err);
    return { ok: false, error: msg };
  }
}

function pad(s, w) { return String(s).padEnd(w, ' '); }

async function main() {
  console.log(`Connecting to ${HOST}:${PORT} (unit ${UNIT_ID})...`);

  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('error', reject);
    socket.connect({ host: HOST, port: PORT });
  }).catch((err) => {
    console.error(`Failed to connect: ${err.message}`);
    console.error('If the Homey app is currently connected, the inverter may');
    console.error('be refusing additional TCP connections. Disable the device');
    console.error('in Homey and try again.');
    process.exit(1);
  });
  console.log('Connected.\n');

  const NAME_W = 36;
  const ADDR_W = 6;
  const VAL_W  = 22;
  console.log(pad('Register', NAME_W) + pad('Addr', ADDR_W) + pad('Value', VAL_W) + 'Notes');
  console.log('-'.repeat(NAME_W + ADDR_W + VAL_W + 40));

  const results = {};
  for (const reg of REGISTERS) {
    const r = await readOne(reg);
    results[reg.addr] = r;
    const value = r.ok
      ? `${r.display}${reg.unit ? ` (${reg.unit})` : ''}`
      : `ERROR: ${r.error}`;
    console.log(
      pad(reg.name, NAME_W) +
      pad(reg.addr, ADDR_W) +
      pad(value, VAL_W) +
      (reg.note || ''),
    );
  }

  console.log('\n--- Diagnosis hints ---');

  const limitedPower = results[43052];
  if (limitedPower && limitedPower.ok) {
    const pct = limitedPower.raw / 100;
    if (pct < 100) {
      console.log(`! 43052 Limited Power Setting = ${pct}% — inverter is capping output below 100%.`);
      console.log('  This can prevent forced export from taking effect.');
    } else {
      console.log(`OK 43052 Limited Power Setting = ${pct}% (no active power cap).`);
    }
  }

  const passive = results[43311];
  if (passive && passive.ok && passive.raw === 0xAA55) {
    console.log('! 43311 Passive Mode = ON. EXPORT requires it OFF (0).');
  }

  const forceCD = results[43135];
  if (forceCD && forceCD.ok && forceCD.raw !== 0) {
    console.log(`! 43135 = ${forceCD.raw} (not OFF). 43132/43133 export is mutually exclusive with 43135 ≠ 0.`);
  }

  const gridAdj = results[43132];
  const sysPower = results[43133];
  if (gridAdj && gridAdj.ok && sysPower && sysPower.ok) {
    if (gridAdj.raw === 1 && sysPower.raw === 0) {
      console.log('! 43132 = 1 but 43133 = 0. The inverter is accepting the control mode but');
      console.log('  silently dropping the export power target. Most likely a backflow / EPM /');
      console.log('  meter-position constraint, or a firmware regression on this register.');
    }
  }

  console.log('\nDone. Closing connection.');
  socket.destroy();
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  socket.destroy();
  process.exit(1);
});
