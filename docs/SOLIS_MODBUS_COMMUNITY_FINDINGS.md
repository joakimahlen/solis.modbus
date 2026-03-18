# Solis Modbus Control — Community Findings & External Research

> **Last updated:** 2026-03-18
> **Purpose:** Document how other integrations and users control Solis inverters via Modbus, with particular focus on register behavior, forced modes, and the inverter's tendency to override written values.

---

## 1. Storage Control Mode (Register 43110)

Register 43110 is the **Energy Storage Control Switch** — a read/write bit field (readable at input register 33132). Each bit enables a specific mode:

| Bit | Value | Mode |
|-----|-------|------|
| 0 | 1 | Self-Use (Spontaneous Mode) |
| 1 | 2 | Timed Mode (TOU charge/discharge) |
| 2 | 4 | Off-Grid Mode |
| 3 | 8 | Battery Wake-Up Mode |
| 4 | 16 | Backup/Reserve Mode |
| 5 | 32 | Allow Grid Charge |
| 6 | 64 | Feed-In Priority Mode |

### Combined Values Used by Other Integrations

From the SolaX Modbus / Predbat integration (`SOLAX_SOLIS_MODES_NEW`):

| Value | Bits | Mode Description |
|-------|------|-----------------|
| 1 | 0 | Self-Use — no grid charging |
| 3 | 0+1 | Timed Charge/Discharge — no grid charging |
| 17 | 0+4 | Backup/Reserve — no grid charging |
| 33 | 0+5 | Self-Use + grid charge (Auto Mode) |
| 35 | 0+1+5 | Timed Charge/Discharge + grid charge |
| 37 | 0+2+5 | Off-Grid Mode |
| 41 | 0+3+5 | Battery Awaken |
| 43 | 0+1+3+5 | Battery Awaken + Timed Charge/Discharge |
| 51 | 0+1+4+5 | Backup/Reserve + grid charge |
| 64 | 6 | Feed-In Priority — no grid charging |
| 96 | 5+6 | Feed-In Priority — no timed charge |
| 98 | 1+5+6 | Feed-In Priority |

### Our App's Usage

Our app uses additional undocumented bits beyond the standard 7 bits:

| Our Value | Bits | Our Mode |
|-----------|------|----------|
| 33 | 0+5 | SELF_USE |
| 2080 | 5+11 | PEAK_SHAVING (bit 11 = 2048) |
| 305 | 0+4+5+8 | CHARGE (bit 8 = 256 = BATTERY_FORCE_CHARGE_PEAK_SHAVING) |
| 257 | 0+8 | DISCHARGE, IDLE, EXPORT |

Bits 8+ (256, 512, 1024, 2048) are not documented in public Modbus tables and appear to come from NDA documentation or experimentation. The inverter accepts these values.

### Important Finding: Feed-In Priority (Bit 6)

We attempted to use bit 6 (FEED_IN_PRIORITY = 64) to distinguish EXPORT mode from DISCHARGE/IDLE. **The inverter rejected it** — it wrote 321 (257 | 64) but read back 257, stripping the feed-in priority bit. This may be model/firmware dependent.

---

## 2. Force Charge/Discharge (Register 43135)

### Values
- `0` = OFF
- `1` = Battery charge (uses power from register 43136)
- `2` = Battery discharge (uses power from register 43129)

### The 5-Minute Dead Man's Switch

Register 43135 has a **firmware-level safety mechanism**: it automatically resets to `0` after approximately 5 minutes if not rewritten. This is deliberate — it prevents uncontrolled charge/discharge if the controlling system loses communication.

**How it works:**
1. Write `1` or `2` to 43135
2. Inverter begins charging/discharging at the power in 43136/43129
3. After ~5 minutes, firmware resets 43135 back to `0`
4. Charging/discharging stops
5. Must rewrite 43135 before timeout expires to maintain operation

This register is stored in **RAM, not flash**, so frequent rewriting is safe and will not cause flash wear.

### How Other Integrations Handle It
- **SolaX Modbus (Home Assistant):** Rewrites on each poll cycle (typically 15-30 seconds)
- **Predbat:** Relies on SolaX Modbus for low-level rewriting
- **GrugBus:** Continuous Python polling that rewrites each cycle
- **Custom automations:** Home Assistant automations that rewrite every 1-4 minutes
- **Our app:** Stores desired mode, detects current mode each poll, rewrites when they differ

---

## 3. Force Charge/Discharge Power (Registers 43129, 43136)

### Registers
- **43136**: Force battery **charge** power — active when 43135 = 1
- **43129**: Force battery **discharge** power — active when 43135 = 2

### Scale Factor
Both use **1 unit = 10W**:
- Writing `5` = 50W
- Writing `100` = 1000W
- Writing `250` = 2500W

### Working Examples from Community
| 43135 | 43136 | 43129 | Result |
|-------|-------|-------|--------|
| 1 | 5 | — | Battery charges at ~50W |
| 1 | 250 | — | Battery charges at 2500W |
| 2 | — | 10 | Battery discharges at 100W (for 5 min) |

### Gotchas
- Maximum value bounded by inverter rated power and battery specs
- Some firmware versions don't respond to `43135 = 2` (discharge) while charge works fine
- Register 43130 (Battery Charge Limit Power) may need to be set appropriately
- These are **RAM-stored** — safe for frequent writing, reset on power cycle

---

## 4. Grid Port Power Control (Registers 43128, 43132, 43133)

### Register 43132 — Remote Control: Grid Adjustment
| Value | Meaning |
|-------|---------|
| 0 | OFF |
| 1 | ON — System Grid Connection Point (uses register 43133) |
| 2 | ON — Inverter AC Port (uses register 43128) |

**WARNING: Multiple users report this register is completely unresponsive.** From DIY Solar Forum: *"The remote control grid blah blah registers have never worked."* This may be firmware-dependent.

### Register 43128 — Active Power on Grid Port
- S16, scale 10W
- Positive = export to grid, Negative = import from grid
- Part of the NDA-protected register set
- Requires 43132 = 2 to be active (if 43132 works on your firmware)

### Register 43133 — Active Power at System Grid Connection Point
- S16, scale 10W
- Positive = export, Negative = import
- Requires 43132 = 1 to be active
- Alternative to 43128, targets meter location instead of inverter AC port

### Important: 43135 and 43132 Are Mutually Exclusive
Per NDA documentation: *"When set to ON, Remote Control Grid Adjustment will set to OFF"* — meaning registers 43135 (force charge direction) and 43132 (grid adjustment) cannot both be active simultaneously.

### Community Status on Forced Grid Export
**No other open-source integration successfully implements forced grid export via registers 43128/43132/43133.** The community has largely concluded:
1. Grid control registers (43132 etc.) don't function as documented on many firmwares
2. Battery control registers (43135/43136/43129) work but only control battery, not grid export directly
3. The only reliable alternative is the **MITM smartmeter approach** (see Section 7)

### Our Testing Results (2026-03-18)

**Registers 43128 and 43132 DO work on our firmware**, contrary to most community reports. Key findings:

1. **43132 = 2 (inverter mode) + 43128**: Controls total **inverter AC output power**, NOT grid export directly. The inverter targets X watts at its AC port, using PV + battery discharge to reach the target. Whatever the house doesn't consume flows to the grid. Example: setting 43128 = 3200W with PV=1800W and house_load=1700W → battery discharges ~1400W, grid export ~1500W.

2. **Passive mode must be OFF**: These registers only work when passive mode is disabled (43311 ≠ 0xAA55). When passive mode is enabled, the grid port power control is overridden by passive mode dispatch logic.

3. **43132 = 1 (system mode) + 43133**: **WORKS — controls export at the grid meter point.** Setting 43133 = 1200 resulted in METER_POWER reading 1188W export. The inverter automatically adjusts battery discharge to hit the target regardless of house load. This is precise grid export control.

4. **43135 must be OFF**: Registers 43135 and 43132 are mutually exclusive per NDA docs. Our EXPORT mode sets 43135 = 0.

### Our EXPORT Mode Implementation
Our app uses 43132 + 43128/43133 for forced export. This is firmware-dependent and may not work on all models. If register 43132 is unresponsive, EXPORT mode will not function. Fallback options:
- Using 43135 = 2 (force discharge) with high discharge power, relying on excess power flowing to grid
- MITM smartmeter approach (requires hardware)

---

## 5. Passive Mode (Register 43311)

### What It Does
Writing `0xAA55` (43605 decimal) to register 43311 puts the inverter in **passive mode**:
- Disables the inverter's built-in "intelligence" (self-use optimization, automatic battery management)
- Allows external systems to take full manual control of battery charge/discharge
- The inverter becomes a "dumb" power converter that follows explicit register commands

### NDA Status
Register 43311 is **part of the NDA-protected register set** — it does not appear in the public Non-NDA Modbus Table. Community knowledge comes from:
- Users who signed NDAs and shared partial information
- Reverse engineering and experimentation
- The SolaX Modbus integration documentation (which documents it openly)

### Usage by Other Integrations
- **SolaX Modbus:** Documents passive mode as a first-class operating mode
- **GrugBus:** Uses the MITM approach instead, avoiding passive mode entirely
- **Our app:** Uses `43311 = 0xAA55` for CHARGE, DISCHARGE, IDLE, PEAK_SHAVING modes. Disables it (`43311 = 0`) for SELF_USE and EXPORT (grid port power control requires passive mode OFF)

### Relationship to Other Registers
Passive mode acts as a **prerequisite** for force charge/discharge registers to work reliably:
- Without passive mode, the inverter's built-in logic may **fight against** values written to 43135/43136/43129
- With passive mode, the inverter accepts and follows explicit commands
- Related register 43310: writing `35` = "run" (enable timed dispatch), `33` = "stop"

---

## 6. Inverter Randomly Overwriting Register Values

This is the single most discussed Solis Modbus issue across all community forums. There are several distinct types of reset behavior:

### Type 1: Dead Man's Switch (Predictable)
- Register 43135 resets to 0 after ~5 minutes
- This is a **deliberate safety feature**, not a bug
- Predictable and well-understood
- Solution: rewrite on a schedule shorter than 5 minutes

### Type 2: HMI/Firmware Override (Persistent Desired State)
- When you write values via Modbus, the HMI (inverter display) shows the new values
- **When you stop writing, the inverter reverts to its own pre-set values**
- The inverter maintains its own "desired" state internally and treats Modbus-written values as **temporary overrides**
- Quote: *"There is something in the inverter that discards Modbus sent values"*
- Solution: continuous rewriting (which is what our rewrite mechanism does)

### Type 3: SolisCloud / Datalogger Conflicts
- If SolisCloud is connected via a datalogger, **the cloud can push settings that overwrite local Modbus changes**
- The datalogger periodically reads and writes registers, creating a "fight" between local control and cloud control
- Multiple Modbus masters on the same RS485 bus cause **bus collisions** that can corrupt register values
- Some dataloggers don't support multiple TCP connections
- Solution: use the dual-adaptor workaround, or disconnect SolisCloud during Modbus control

### Type 4: Internal Safety Logic Override
- The inverter has built-in safety logic that can override certain register values
- Example: it won't accept export power values above the "backflow limit" setting
- The inverter's internal feedback loops constantly adjust behavior regardless of Modbus commands
- State transitions (battery full, battery empty, grid fault) can reset control registers

### Firmware Differences
- **Older firmware:** Remote dispatch registers existed in the Modbus map but did nothing
- **Newer firmware:** Remote control registers (43135, 43136, 43129) were "unlocked" and started working after specific firmware updates
- **HMI firmware FB00+:** Supports six independent charge/discharge slots with separate current settings and target SOCs
- DSP and HMI firmware versions readable from registers 33001 and 33002

### No Official Documentation
Solis does not publicly document the automatic reset behavior. The writable register documentation is behind NDA. All community knowledge comes from experimentation and reverse engineering.

### Flash Memory Write Cycle Concerns
**Critical distinction** between flash-stored and RAM-stored registers:

| Type | Behavior | Write Safety | Examples |
|------|----------|--------------|----------|
| Flash-stored | Survives power cycle | Limited (10K-100K cycles) — **can brick the inverter** | Configuration registers (charge schedules, time slots) |
| RAM-stored | Resets on power cycle | Unlimited — safe for frequent writing | Control registers (43135, 43136, 43129) |

**How to tell:** power-cycle the inverter. If a setting survives, it's flash-stored. If it resets, it's RAM.

**Best practice:** Use RAM-based control registers for real-time control (rewriting every 10-30 seconds is fine). Only write flash-based configuration registers a few times per day.

---

## 7. Alternative: MITM Smartmeter Approach (GrugBus)

Since grid export registers (43128/43132/43133) are unreliable, the GrugBus project uses a hardware workaround:

1. Two RS485 interfaces on an Orange Pi Lite
2. One reads the **real** smartmeter data
3. The other **fakes a smartmeter** that the inverter queries
4. By adding/subtracting a constant P from `active_power`, the inverter's internal feedback loop is tricked into exporting or importing the desired amount
5. Combined with battery charge/discharge registers, this gives complete grid export control

This is the only approach in the community that reliably controls grid export power, but it requires additional hardware.

---

## Sources

### GitHub Repositories
- [wills106/homeassistant-solax-modbus](https://github.com/wills106/homeassistant-solax-modbus) — Primary Home Assistant integration for Solis
- [peufeu2/GrugBus](https://github.com/peufeu2/GrugBus) — Python-based Solis control with MITM meter approach
- [Pho3niX90/solis_modbus](https://github.com/Pho3niX90/solis_modbus) — Monitoring-focused Solis integration
- [fboundy/ha_solis_modbus](https://github.com/fboundy/ha_solis_modbus) — YAML-based HA Modbus config
- [springfall2008/batpred (Predbat)](https://github.com/springfall2008/batpred) — Battery prediction and automation
- [alienatedsec/solis-ha-modbus-cloud](https://github.com/alienatedsec/solis-ha-modbus-cloud) — Dual SolisCloud + Modbus setup

### Documentation
- [SolaX Modbus — Solis Operation Modes](https://homeassistant-solax-modbus.readthedocs.io/en/latest/solis-operation-modes/)
- [Solis Service Center — Non-NDA Modbus Table](https://solis-service.solisinverters.com/en/support/solutions/articles/44002663852-non-nda-modus-table)
- [Solis NA — Energy Storage Operating Modes](https://usservice.solisinverters.com/support/solutions/articles/73000560490-energy-storage-operating-modes)
- [Solis Exporter References](https://solis-exporter.readthedocs.io/en/latest/references/)

### Community Forums
- [DIY Solar Forum — Controlling Solis S5 Hybrid via Modbus](https://diysolarforum.com/threads/controlling-solis-s5-hybrid-via-modbus.104535/)
- [DIY Solar Forum — Solis S6 Control Battery Discharge via Modbus](https://diysolarforum.com/threads/solis-s6-control-battery-discharge-via-modbus-and-openhab.115237/)
- [DIY Solar Forum — Help with Solis inverter battery control via Modbus](https://diysolarforum.com/threads/help-with-solis-inverter-battery-control-via-modbus.112959/)
- [DIY Solar Forum — Read/Write Cycle Reliability of Solis Modbus Registers](https://diysolarforum.com/threads/read-write-cycle-reliability-of-solis-modbus-registers.75809/)
- [DIY Solar Forum — Modbus Register Backflow Power](https://diysolarforum.com/threads/modbus-register-backflow-power-for-solis-hybrid-inverter.60195/)
- [Home Assistant Community — Solis Inverter Modbus Integration](https://community.home-assistant.io/t/solis-inverter-modbus-integration/292553)
