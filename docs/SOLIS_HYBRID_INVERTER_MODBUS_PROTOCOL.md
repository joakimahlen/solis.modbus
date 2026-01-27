# Solis Hybrid Inverter RS485 Modbus RTU Protocol Reference

> **Protocol Version:** 3.1  
> **Document Purpose:** Machine-readable reference for Claude AI assistance with Solis hybrid inverter Modbus communication  
> **Applicable Models:** Hybrid grid-tied inverters (RHI series, S5, S6 generations, AC Coupled, etc.)

---

## 1. Communication Overview

This protocol enables communication between Solis hybrid grid-tied inverters and monitoring systems using **Modbus RTU** over RS485.

### Physical Interface (RS485)

| Parameter | Value |
|-----------|-------|
| Baud Rate | 9600 bps |
| Parity | None |
| Data Bits | 8 |
| Stop Bits | 1 |
| Mode | Master-Slave, Asynchronous |

### Timing Requirements

- **Inter-frame interval:** Minimum 300ms between communication frames
- **Maximum frame size:** 100 bytes (50 registers) recommended

---

## 2. Data Types

| Type | Description | Byte Order |
|------|-------------|------------|
| `U16` | 2-byte unsigned integer | High byte first, then low |
| `S16` | 2-byte signed integer | High byte first, then low |
| `U32` | 4-byte unsigned integer | High word first, then low word; high byte before low byte |
| `S32` | 4-byte signed integer | High word first, then low word; high byte before low byte |
| `Str` | ASCII string | Stored across multiple U16 registers |

---

## 3. Frame Structure

```
┌──────────────┬───────────────┬──────────────┬─────────────┐
│ Slave Address│ Function Code │    Data      │  CRC Check  │
│    8 bits    │    8 bits     │   N×8 bits   │   16 bits   │
└──────────────┴───────────────┴──────────────┴─────────────┘
```

- **Slave Address:** Must match inverter address. Broadcast address `0xFF` for remote control write-only.
- **CRC Check:** CRC lookup table mode, high byte first.

---

## 4. Function Codes

| Code (Hex) | Name | Register Range | Purpose |
|------------|------|----------------|---------|
| `0x03` | Read Holding Registers | 40001-49999 | Read setting/configuration parameters |
| `0x04` | Read Input Registers | 30001-39999 | Read real-time operating data |
| `0x06` | Write Single Holding Register | 40001-49999 | Set single parameter |
| `0x10` | Write Multiple Holding Registers | 40001-49999 | Set multiple parameters |

> **Note:** When slave receives address `0xFF` with write command, it executes but does not respond.

---

## 5. Error Response Format

When an error (other than CRC) is detected:

```
┌──────────────┬─────────────────┬────────────┬─────────────┐
│ Slave Address│ Function | 0x80 │ Error Code │  CRC Check  │
│    8 bits    │    8 bits       │   8 bits   │   16 bits   │
└──────────────┴─────────────────┴────────────┴─────────────┘
```

### Error Codes

| Code | Meaning |
|------|---------|
| `0x01` | Illegal function code |
| `0x02` | Illegal data address |
| `0x03` | Illegal data value |
| `0x04` | Service failure (data access error during execution) |
| `0x05` | HMI and DSP communication failure |

---

## 6. Input Registers (Function Code 0x04) - Operating Data

### 6.1 Device Identification

| Register | Name | Type | Unit | Notes |
|----------|------|------|------|-------|
| 35000 | Solis Inverter Model Definition | U16 | - | See Model Codes section |
| 33000 | Model No. | U16 | - | - |
| 33001 | DSP Version | U16 | Hex | High byte: slave DSP, Low byte: master DSP |
| 33002 | HMI Version | U16 | Hex | Combined with 33069 for full version |
| 33003 | Protocol Version | U16 | Hex | - |
| 33004-33019 | Serial Number (SN) | U16×16 | ASCII | 32-bit ASCII, highest to lowest |
| 33069 | HMI Sub Version | U16 | - | Combined with 33002 |

### 6.2 System Time

| Register | Name | Type | Range |
|----------|------|------|-------|
| 33022 | Year | U16 | 0-99 |
| 33023 | Month | U16 | 1-12 |
| 33024 | Day | U16 | 1-31 |
| 33025 | Hour | U16 | 0-23 |
| 33026 | Minute | U16 | 0-59 |
| 33027 | Second | U16 | 0-59 |

### 6.3 PV Input Data

| Register | Name | Type | Unit | Conversion |
|----------|------|------|------|------------|
| 33048 | DC Input Type | U16 | - | 0=1 input, 1=2 inputs, 2=3 inputs, etc. |
| 33049 | DC Voltage 1 | U16 | 0.1V | ÷10 for V |
| 33050 | DC Current 1 | U16 | 0.1A | ÷10 for A |
| 33051 | DC Voltage 2 | U16 | 0.1V | ÷10 for V |
| 33052 | DC Current 2 | U16 | 0.1A | ÷10 for A |
| 33053 | DC Voltage 3 | U16 | 0.1V | ÷10 for V |
| 33054 | DC Current 3 | U16 | 0.1A | ÷10 for A |
| 33055 | DC Voltage 4 | U16 | 0.1V | ÷10 for V |
| 33056 | DC Current 4 | U16 | 0.1A | ÷10 for A |
| 33057-33058 | Total DC Output Power | U32 | 1W | PV Power |

### 6.4 AC Grid Data

| Register | Name | Type | Unit | Conversion |
|----------|------|------|------|------------|
| 33047 | AC Output Type | U16 | - | 0=1P, 1=3P4W, 2=3P3W, 3=3P4W or 3P3W |
| 33071 | DC Bus Voltage | U16 | 0.1V | ÷10 for V |
| 33072 | DC Bus Half Voltage | U16 | 0.1V | ÷10 for V |
| 33073 | Phase A / AB Line Voltage | U16 | 0.1V | ÷10 for V |
| 33074 | Phase B / BC Line Voltage | U16 | 0.1V | ÷10 for V |
| 33075 | Phase C / CA Line Voltage | U16 | 0.1V | ÷10 for V |
| 33076 | Phase A Current | U16 | 0.1A | ÷10 for A |
| 33077 | Phase B Current | U16 | 0.1A | ÷10 for A |
| 33078 | Phase C Current | U16 | 0.1A | ÷10 for A |
| 33079-33080 | Active Power | S32 | 1W | Signed |
| 33081-33082 | Reactive Power | S32 | 1Var | Signed |
| 33083-33084 | Apparent Power | S32 | 1VA | Signed |
| 33094 | Grid Frequency | U16 | 0.01Hz | ÷100 for Hz |

### 6.5 Battery Data

| Register | Name | Type | Unit | Conversion | Notes |
|----------|------|------|------|------------|-------|
| 33045 | BMS Battery Voltage (High) | U16 | 0.01V | Combined with 33141 for >655.35V |
| 33141 | BMS Battery Voltage (Low) | U16 | 0.01V | ÷100 for V |
| 33133 | Inverter Battery Voltage | U16 | 0.1V | ÷10 for V |
| 33134 | Battery Current | S16 | 0.1A | ÷10 for A, +charge/-discharge |
| 33135 | Battery Current Direction | U16 | - | 0=charge, 1=discharge |
| 33142 | BMS Battery Current | S16 | 0.1A | ÷10 for A (from BMS) |
| 33139 | Battery SOC | U16 | 1% | State of Charge |
| 33140 | Battery SOH | U16 | 1% | State of Health |
| 33143 | Battery Charge Current Limit | U16 | 0.1A | From BMS |
| 33144 | Battery Discharge Current Limit | U16 | 0.1A | From BMS |
| 33149-33150 | Battery Power | S32 | 1W | Signed |
| 33046 | Battery MOS Temperature | S16 | 0.1°C | S6 models only |
| 33096 | Lead-acid Battery Temperature | S16 | 0.1°C | - |

### 6.6 Energy Statistics

| Register | Name | Type | Unit | Notes |
|----------|------|------|------|-------|
| 33029-33030 | PV Total Energy Generation | U32 | 1kWh | - |
| 33031-33032 | PV Current Month Energy | U32 | 1kWh | - |
| 33033-33034 | PV Last Month Energy | U32 | 1kWh | - |
| 33035 | PV Today Energy | U16 | 0.1kWh | ÷10 for kWh |
| 33036 | PV Yesterday Energy | U16 | 0.1kWh | ÷10 for kWh |
| 33161-33162 | Battery Total Charge Energy | U32 | 1kWh | - |
| 33163 | Battery Today Charge Energy | U16 | 0.1kWh | ÷10 for kWh |
| 33165-33166 | Battery Total Discharge Energy | U32 | 1kWh | - |
| 33167 | Battery Today Discharge Energy | U16 | 0.1kWh | ÷10 for kWh |
| 33169-33170 | Total Energy from Grid | U32 | 1kWh | Import |
| 33171 | Today Energy from Grid | U16 | 0.1kWh | - |
| 33173-33174 | Total Energy to Grid | U32 | 1kWh | Export |
| 33175 | Today Energy to Grid | U16 | 0.1kWh | - |
| 33177-33178 | Total Load Consumption | U32 | 1kWh | House + Backup |
| 33179 | Today Load Consumption | U16 | 0.1kWh | - |

### 6.7 Backup/EPS Data

| Register | Name | Type | Unit | Conversion |
|----------|------|------|------|------------|
| 33137 | Backup AC Voltage (Phase A) | U16 | 0.1V | ÷10 for V |
| 33138 | Backup AC Current (Phase A) | U16 | 0.1A | ÷10 for A |
| 33153 | Backup AC Voltage (Phase B) | U16 | 0.1V | ÷10 for V |
| 33154 | Backup AC Current (Phase B) | U16 | 0.1A | ÷10 for A |
| 33155 | Backup AC Voltage (Phase C) | U16 | 0.1V | ÷10 for V |
| 33156 | Backup AC Current (Phase C) | U16 | 0.1A | ÷10 for A |
| 33147 | Household Load Power | U16 | 1W | Grid port loads only |
| 33148 | Backup Load Power | U16 | 1W | - |
| 33151-33152 | Inverter AC Grid Port Power | S32 | 1W | +to grid, -from grid |

### 6.8 Meter Data

| Register | Name | Type | Unit | Conversion |
|----------|------|------|------|------------|
| 33250 | Meter/CT Position | U16 | - | See Meter Position codes |
| 33251 | Meter AC Voltage A | U16 | 0.1V | ÷10 for V |
| 33252 | Meter AC Current A | U16 | 0.01A | ÷100 for A |
| 33253 | Meter AC Voltage B | U16 | 0.1V | ÷10 for V |
| 33254 | Meter AC Current B | U16 | 0.01A | ÷100 for A |
| 33255 | Meter AC Voltage C | U16 | 0.1V | ÷10 for V |
| 33256 | Meter AC Current C | U16 | 0.01A | ÷100 for A |
| 33263-33264 | Meter Total Active Power | S32 | 0.001kW | ÷1000 for kW |
| 33281 | Meter Power Factor | S16 | 0.01 | ÷100 for PF |
| 33282 | Meter Grid Frequency | U16 | 0.01Hz | ÷100 for Hz |
| 33283-33284 | Meter Total Energy from Grid | U32 | 0.01kWh | ÷100 for kWh |
| 33285-33286 | Meter Total Energy to Grid | U32 | 0.01kWh | ÷100 for kWh |

### 6.9 Status and Fault Registers

| Register | Name | Type | Notes |
|----------|------|------|-------|
| 33095 | Inverter Current Status | U16 | See Status Codes |
| 33097 | Function Status | U16 | Bit field - see Function Status Bits |
| 33111 | Battery BMS Status | U16 | 0=normal, 1=comm error, 2=warning |
| 33112 | Inverter Initial Setting State | U16 | See Initial State Bits |
| 33116-33120 | Fault Code 01-05 | U16 | See Fault Codes |
| 33121 | Operating Status | U16 | See Operating Status |
| 33122 | Operating Mode | U16 | Single active mode |
| 33123 | Working Mode Running Status | U16 | Bit field for mode status |
| 33124-33125 | Fault Code 06-07 | U16 | See Fault Codes |
| 33145-33146 | Battery Fault Status 01-02 | U16 | From BMS |

### 6.10 Temperature

| Register | Name | Type | Unit |
|----------|------|------|------|
| 33044 | Ground Voltage (V_Ground) | U16 | 0.1V |
| 33093 | Inverter Module Temperature | S16 | 0.1°C |
| 33099 | Inverter Cabinet Temperature | S16 | 0.1°C |
| 33107 | Inverter Module Temperature 2 | S16 | 0.1°C |

### 6.11 Control Feedback

| Register | Name | Type | Unit | Notes |
|----------|------|------|------|-------|
| 33104 | Limited Power Actual Value | U16 | 0.01% | 10000=100% |
| 33105 | PF Adjustment Actual Value | S16 | 0.001 | 1000=1.00, -1000=-1.00 |
| 33106 | Limited Reactive Power | S16 | 0.01% | Range -6000 to +6000 |
| 33091 | Standard Working Modes | U16 | - | Current active mode |

---

## 7. Holding Registers (Function Codes 0x03/0x06/0x10) - Settings

### 7.1 System Time Settings

| Register | Name | Type | Range | Default |
|----------|------|------|-------|---------|
| 43000 | Year | U16 | 0-99 | - |
| 43001 | Month | U16 | 1-12 | - |
| 43002 | Day | U16 | 1-31 | - |
| 43003 | Hour | U16 | 0-23 | - |
| 43004 | Minute | U16 | 0-59 | - |
| 43005 | Second | U16 | 0-59 | - |

### 7.2 Basic Control

| Register | Name | Type | Values | Notes |
|----------|------|------|--------|-------|
| 43006 | Slave Address | U16 | 1-99 | Only 0x06 function code |
| 43007 | ON/OFF | U16 | 0xBE=ON, 0xDE=OFF | - |
| 43008 | Initial Startup Setting | U16 | 1=complete, 0=not complete | - |
| 43009 | Current Battery Model | U16 | - | See Battery Model codes |

### 7.3 Battery Settings

| Register | Name | Type | Unit | Range | Default | Notes |
|----------|------|------|------|-------|---------|-------|
| 43010 | Overcharge SOC | U16 | 1% | 70-100% | 95% | - |
| 43011 | Overdischarge SOC | U16 | 1% | 5-40% | 20% | Must be ≥ Force charge SOC |
| 43012 | Max Charge Current | U16 | 0.1A | Model dependent | - | LV: 50-100A, HV: 5-100A |
| 43013 | Max Discharge Current | U16 | 0.1A | Model dependent | - | LV: 50-100A, HV: 5-100A |
| 43014 | Charge Overvoltage Threshold | U16 | 0.1V | - | LV:59.5V, HV:556V | - |
| 43015 | Discharge Undervoltage Threshold | U16 | 0.1V | - | LV:46V, HV:120V | - |
| 43016 | Floating Charge Voltage | U16 | 0.1V | - | LV:53.5V, HV:550V | - |
| 43017 | Equalizing Charge Voltage | U16 | 0.1V | - | LV:56.5V, HV:550V | User-def/Lead-acid only |
| 43018 | Force Charge SOC | U16 | 1% | 4% to overdischarge | 10% | - |
| 43019 | Rated Capacity | U16 | 1Ah | 50-500 | 100Ah | User-def/Lead-acid only |
| 43024 | Backup SOC | U16 | 1% | overdischarge-100% | 80% | For backup mode |

### 7.4 Grid Protection Settings

| Register | Name | Type | Unit | Default | Notes |
|----------|------|------|------|---------|-------|
| 43034 | OV-G-V01 (59.S2 for CEI-021) | U16 | 0.1V | 1P:254V, 3P:440V | - |
| 43035 | OV-G-V02 | U16 | 0.1V | 1P:265V, 3P:460V | - |
| 43036 | UN-G-V01 (27.S1 for CEI-021) | U16 | 0.1V | 1P:190V, 3P:330V | - |
| 43037 | UN-G-V02 (27.S2 for CEI-021) | U16 | 0.1V | 1P:173V, 3P:300V | - |
| 43038 | 81>S1 (Over Freq) | U16 | 0.01Hz | 50.2Hz | CEI 0-21 |
| 43039 | 81>S1-T | U16 | 0.01s | 0.10s | - |
| 43040 | 81<S1 (Under Freq) | U16 | 0.01Hz | 49.8Hz | - |
| 43041 | 81<S1-T | U16 | 0.01s | 0.10s | - |
| 43106 | Startup Time | U16 | 1s | 60s | Range 10-600s |
| 43107 | Reconnect Time | U16 | 1s | 60s | Range 10-600s |
| 43068 | Grid Standard | U16 | - | - | See Grid Standard codes |

### 7.5 Power Control Settings

| Register | Name | Type | Unit | Range | Default | Notes |
|----------|------|------|------|-------|---------|-------|
| 43050 | Working Mode Set | U16 | - | 0-5, 0C | 0 | See Working Mode codes |
| 43051 | Limit Reactive Power | S16 | 0.01% | -6000 to +6000 | 0 | Mode 4 only |
| 43052 | Limited Power Setting | U16 | 0.01% | 0-110% | 100% | - |
| 43053 | PF Setting | S16 | 0.001 | -1.0 to +1.0 | 1.00 | 800=0.80, 1000=1.00 |

### 7.6 Storage Control Switch (Register 43110)

Bit field for energy storage control:

| Bit | Function | Values |
|-----|----------|--------|
| BIT00 | AC Backup Enable | 0=disable, 1=enable |
| BIT01 | Battery Charge/Discharge Enable | 0=disable, 1=enable |
| BIT02 | Force Battery Charge from Grid | 0=disable, 1=enable |
| BIT03 | Reserve | - |
| BIT04 | Time-of-Use Enable | 0=disable, 1=enable |
| BIT05 | Self-Use Mode | 0=disable, 1=enable |
| BIT06 | Feed-in Priority | 0=disable, 1=enable |
| BIT07 | Off-Grid Mode Enable | 0=disable, 1=enable |

### 7.7 Backup Settings

| Register | Name | Type | Unit | Default |
|----------|------|------|------|---------|
| 43111 | Backup Circuit Enable | U16 | - | 1 (enable) |
| 43112 | Backup Reference Voltage | U16 | 0.1V | 230V |
| 43113 | Backup Reference Frequency | U16 | 0.01Hz | 50Hz |

### 7.8 Battery Charge/Discharge Settings

| Register | Name | Type | Unit | Range | Notes |
|----------|------|------|------|-------|-------|
| 43114 | Battery Charge/Discharge Enable | U16 | - | 0=disable, 1=enable | - |
| 43115 | Battery Charge/Discharge Direction | U16 | - | 0=charge, 1=discharge | - |
| 43116 | Battery Charge/Discharge Current | U16 | 0.1A | 0 to rated | - |
| 43117 | Battery Max Charge Current | U16 | 0.1A | 1 to max | - |
| 43118 | Battery Max Discharge Current | U16 | 0.1A | 1 to max | - |
| 43119 | Battery Undervoltage Protection | U16 | 0.1V | 40-48V (LV) | - |
| 43120 | Battery Floating Charge Voltage | U16 | 0.1V | 50-58V (LV) | - |
| 43121 | Battery Equalizing Charge Voltage | U16 | 0.1V | 54-60V (LV) | - |
| 43122 | Battery Overvoltage Protection | U16 | 0.1V | 54-62V (LV) | - |

### 7.9 Time-of-Use Charging Settings

| Register | Name | Type | Unit | Notes |
|----------|------|------|------|-------|
| 43141 | Time Charging - Charge Current | U16 | 0.1A | - |
| 43142 | Time Charging - Discharge Current | U16 | 0.1A | - |
| 43143 | Charge Period 1 - Start Hour | U16 | 1 hour | - |
| 43144 | Charge Period 1 - Start Minute | U16 | 1 min | - |
| 43145 | Charge Period 1 - End Hour | U16 | 1 hour | - |
| 43146 | Charge Period 1 - End Minute | U16 | 1 min | - |
| 43147 | Discharge Period 1 - Start Hour | U16 | 1 hour | - |
| 43148 | Discharge Period 1 - Start Minute | U16 | 1 min | - |
| 43149 | Discharge Period 1 - End Hour | U16 | 1 hour | - |
| 43150 | Discharge Period 1 - End Minute | U16 | 1 min | - |

> **Note:** Up to 5 time periods available (registers 43153-43190)

### 7.10 Remote Control Settings

| Register | Name | Type | Unit | Notes |
|----------|------|------|------|-------|
| 43128 | Remote Control - Active Power on Grid Port | S16 | 10W | +export, -import |
| 43129 | Remote Control - Force Battery Discharge Power | U16 | 10W | - |
| 43130 | Battery Charge Limit Power | U16 | 10W | - |
| 43131 | Battery Discharge Limit Power | U16 | 10W | - |
| 43132 | Remote Control - Grid Adjustment | U16 | - | 0=OFF, 1=ON(system), 2=ON(inverter) |
| 43133 | Remote Control - Active Power at System Point | S16 | 10W | +export, -import |
| 43134 | Remote Control - Reactive Power at System Point | S16 | 10Var | +export, -import |
| 43135 | Remote Control - Force Battery Charge/Discharge | U16 | - | 0=OFF, 1=charge, 2=discharge |
| 43136 | Remote Control - Force Battery Charge Power | U16 | 10W | - |

### 7.11 Meter Settings

| Register | Name | Type | Notes |
|----------|------|------|-------|
| 43029 | Meter CT Direction | U16 | 0=positive, 1=reverse |
| 43073 | Meter/CT Position | U16 | See Meter Position codes |
| 43140 | Meter Type and Location | U16 | High byte=location, Low byte=type |

### 7.12 EPS/Off-Grid Settings

| Register | Name | Type | Unit | Range | Default |
|----------|------|------|------|-------|---------|
| 43137 | Off-Grid Overdischarge SOC | U16 | 1% | 10-100% | 30% |
| 43138 | EPS Overdischarge SOC | U16 | 1% | 10-100% | LV:20%, HV:10% |
| 43139 | EPS Switching Time | U16 | 10ms | 10-99990ms | - |

### 7.13 Miscellaneous Settings

| Register | Name | Type | Notes |
|----------|------|------|-------|
| 43030 | Baud Rate | U16 | 96=9600, 192=19200, 384=38400 |
| 43031 | Restart HMI | U16 | Write 0xAA55 to restart |
| 43033 | Factory Reset | U16 | Write 1 to restore defaults |
| 43055 | Clear Energy Records | U16 | Write 1 to clear |
| 43076 | AFCI Function ON/OFF | U16 | 0=OFF, 1=ON |

---

## 8. Status and Mode Codes

### 8.1 Inverter Status Codes (Register 33095)

| Code | Status | Display |
|------|--------|---------|
| 0x0000 | Normal operation / Waiting | Generating / Waiting |
| 0x0001 | Open Run | OpenRun |
| 0x0002 | Soft Run / Waiting | SoftRun |
| 0x0003 | Initializing / Generating | Generating |
| 0x0004 | Bypass Running / Standby | Standby |
| 0x0005 | Bypass Sync | StandbySync |
| 0x0006 | Grid to Load | GridToLoad |
| 0x000F | Normal Running | Normal |
| 0x1004 | Grid Off | Grid Off |

### 8.2 Fault Codes (Prefix indicates category)

| Code Range | Category | Examples |
|------------|----------|----------|
| 0x101x | Grid Faults | 1010=OV-G-V, 1011=UN-G-V, 1012=OV-G-F, 1013=UN-G-F |
| 0x102x | DC/Bus Faults | 1020=OV-DC, 1021=OV-BUS, 1023=UN-BUS |
| 0x103x | System Faults | 1032=OV-TEM, 1033=PV ISO, 1034=ILeak, 1035=Relay |
| 0x104x | Protection | 1040=AFCI Check, 1041=ARC Fault |
| 0x105x | Battery Faults | 1053=OV-Vbatt, 1054=UN-Vbatt, 1055=NO-Battery |
| 0x106x | Parallel Faults | 1060=SlaveLose, 1061=MasterLose, 1064=Addr Conflict |
| 0x201x | Communication | 2011=Meter COM, 2012=Battery COM, 2014=DSP COM |
| 0x202x | Battery Warnings | 2020=High Temp, 2021=Low Temp |
| 0xF01x | Warnings | F010=Surge, F011=Fan |

### 8.3 Working Mode Codes (Register 43050)

| Code | Mode | Description |
|------|------|-------------|
| 0x00 | No Response | Default mode |
| 0x01 | Volt-Watt Default | Voltage-based power limiting |
| 0x02 | Volt-Var | Voltage-based reactive power |
| 0x03 | Fixed Power Factor | Constant PF operation |
| 0x04 | Fixed Reactive Power | Constant Q operation |
| 0x05 | Power-PF | Active power based PF |
| 0x06 | Rule21 Volt-Watt | California Rule 21 (US only) |
| 0x0C | IEEE1547-2018 P-Q | Required P-Q mode (US only) |

### 8.4 Operating Status (Register 33287)

| Value | Status |
|-------|--------|
| 0 | Stop running |
| 1 | Open loop operation |
| 2 | Soft start operation |
| 3 | Grid-connected operation |
| 4 | Off-grid operation |
| 5 | Off-grid to on-grid transition |
| 6 | Backup bypass |
| 7 | Generator running |

### 8.5 Function Status Bits (Register 33097)

| Bit | Function | Values |
|-----|----------|--------|
| BIT00 | DRM Function | 0=OFF, 1=ON |
| BIT01 | Parallel Running Status | 0=stop, 1=run |
| BIT02 | Master/Slave Status | 0=slave, 1=master |
| BIT03 | 3PH Unbalance Status | 0=balanced, 1=unbalanced |
| BIT04 | Generator Start Conditions Met | 0=no, 1=yes |
| BIT05 | Generator Started | 0=no, 1=yes |
| BIT06 | Battery Independent/Parallel | 0=parallel, 1=independent |
| BIT07 | AFCI Board Present | 0=no, 1=yes |
| BIT08 | AFCI Self-Test Status | 0=not done, 1=finished |

---

## 9. Inverter Model Codes (Register 35000)

| Code (Hex) | Model Type |
|------------|------------|
| 0x0000 | No definition |
| 0x1010 | 1-phase grid-tied (0.7-8K1P, 7-10K1P) |
| 0x1020 | 3-phase grid-tied (3-20K 3P) |
| 0x1021 | 3-phase grid-tied (25-50K, 50-70K, 80-110K, etc.) |
| 0x2030 | 1-phase LV Hybrid inverter |
| 0x2031 | 1-phase LV AC Couple storage inverter |
| 0x2032 | 5-15kWh All-in-one Hybrid |
| 0x2040 | 1-phase HV Hybrid inverter |
| 0x2050 | 3-phase LV Hybrid inverter |
| 0x2060 | 3-phase HV Hybrid inverter 5G |
| 0x2070 | S6 3PH HV 5-10kW Hybrid |
| 0x2071 | S6 3PH HV 12-20kW Hybrid |
| 0x2072 | S6 3PH LV 10-15kW Hybrid |
| 0x2073 | S6 3PH HV 50kW Hybrid |
| 0x2080 | 1-phase HV Hybrid S6 |
| 0x2090 | 1-phase LV Hybrid S6 |
| 0x2091 | S6 1PH LV AC Coupled Hybrid |
| 0x3010 | OGI Off-grid inverter |
| 0x3020 | S6 1PH LV Off-Grid Hybrid |

---

## 10. Grid Standard Codes (Register 43068)

| Code | Standard | Region |
|------|----------|--------|
| 0x01 | G59/3 | UK |
| 0x02 | UL-480V/240V | USA |
| 0x03 | VDE0126 | Germany |
| 0x04 | AS4777-15 | Australia |
| 0x06 | CQC | China |
| 0x07 | ENEL/EN50438IE | Ireland |
| 0x0B | VDE4105 | Germany |
| 0x0C | DK1 | Denmark |
| 0x3D | G98 | UK (small scale) |
| 0x3E | G99 | UK (medium scale) |
| 0x53 | CEI 0-21 | Italy |
| 0x55 | 4777-A (AS4777-2020A) | Australia 2020 |
| 0x56 | 4777-B | Australia |
| 0x57 | 4777-C | Australia |
| 0x58 | 4777-N | New Zealand |

---

## 11. Meter Type and Position (Register 43140)

### Location (High Byte)

| Value | Position |
|-------|----------|
| 0x01 | Grid side |
| 0x02 | Load side |
| 0x03 | Grid + PV (Two Meter mode) |

### Meter Type (Low Byte)

| Value | Type |
|-------|------|
| 0x01 | General 1-Phase |
| 0x02 | Acrel 3-Phase |
| 0x03 | General 3-Phase |
| 0x04 | Standard Eastron 1-Phase |
| 0x05 | Standard Eastron 3-Phase |
| 0x06 | No Meter Mode |

---

## 12. Battery Model Codes (Register 43009)

Common values include manufacturer-specific codes for:
- Pylontech
- BYD
- LG Chem
- Solax
- Solis branded batteries
- Lead-acid (generic)
- User-defined

> **Note:** Refer to inverter documentation for complete battery compatibility list.

---

## 13. Communication Examples

### 13.1 Read Single Input Register (Function 0x04)

**Request:** Read register 35000 (inverter model)
```
TX: 01 04 88 B8 00 01 9A 4F
     │  │  └──┬──┘ └─┬─┘ └─┬─┘
     │  │     │      │     └── CRC
     │  │     │      └── Quantity: 1 register
     │  │     └── Start address: 35000 (0x88B8)
     │  └── Function: 0x04 (Read Input)
     └── Slave address: 1
```

**Response:**
```
RX: 01 04 02 20 30 A0 E4
     │  │  │  └─┬─┘ └─┬─┘
     │  │  │    │     └── CRC
     │  │  │    └── Data: 0x2030 (1-phase LV Hybrid)
     │  │  └── Byte count: 2
     │  └── Function: 0x04
     └── Slave address: 1
```

### 13.2 Read Multiple Input Registers (Function 0x04)

**Request:** Read 3 registers starting at 33000
```
TX: 01 04 80 E8 00 03 19 FF
```

**Response:**
```
RX: 01 04 06 00 F8 00 0C 00 0E 80 80
                └─┬─┘ └─┬─┘ └─┬─┘
                  │     │     └── Data 3
                  │     └── Data 2
                  └── Data 1
```

### 13.3 Write Single Holding Register (Function 0x06)

**Request:** Turn inverter ON (register 43007 = 0x00BE)
```
TX: 01 06 A7 FF 00 BE 1A FE
     │  │  └──┬──┘ └─┬─┘ └─┬─┘
     │  │     │      │     └── CRC
     │  │     │      └── Value: 0x00BE (ON)
     │  │     └── Register: 43007 (0xA7FF)
     │  └── Function: 0x06 (Write Single)
     └── Slave address: 1
```

**Response:** Echo of request
```
RX: 01 06 A7 FF 00 BE 1A FE
```

### 13.4 Write Multiple Holding Registers (Function 0x10)

**Request:** Write 3 registers starting at 43000 (set time)
```
TX: 01 10 A7 F8 00 03 06 00 16 00 0A 00 17 53 10
     │  │  └──┬──┘ └─┬─┘ │  └─┬─┘ └─┬─┘ └─┬─┘ └─┬─┘
     │  │     │      │   │    │     │     │     └── CRC
     │  │     │      │   │    │     │     └── Data 3: 23 (0x17)
     │  │     │      │   │    │     └── Data 2: 10 (0x0A)
     │  │     │      │   │    └── Data 1: 22 (0x16)
     │  │     │      │   └── Byte count: 6
     │  │     │      └── Quantity: 3 registers
     │  │     └── Start address: 43000 (0xA7F8)
     │  └── Function: 0x10 (Write Multiple)
     └── Slave address: 1
```

**Response:**
```
RX: 01 10 A7 F8 00 03 22 8D
```

### 13.5 Error Response Example

**Request:** Invalid address
```
TX: 01 04 88 B8 00 01 9A 4F
```

**Response:**
```
RX: 01 84 02 C2 C1
     │  │  │  └─┬─┘
     │  │  │    └── CRC
     │  │  └── Error code: 0x02 (Invalid address)
     │  └── Function | 0x80 = 0x84
     └── Slave address: 1
```

---

## 14. Common Operations Quick Reference

### Read Real-Time Data

| Data | Registers | Function |
|------|-----------|----------|
| PV Power | 33057-33058 | 0x04 |
| Battery SOC | 33139 | 0x04 |
| Battery Power | 33149-33150 | 0x04 |
| Grid Power | 33151-33152 | 0x04 |
| Load Power | 33147, 33148 | 0x04 |
| Today's Generation | 33035 | 0x04 |
| Status | 33095 | 0x04 |
| Fault Codes | 33116-33120 | 0x04 |

### Control Operations

| Operation | Register | Value | Function |
|-----------|----------|-------|----------|
| Turn ON | 43007 | 0x00BE | 0x06 |
| Turn OFF | 43007 | 0x00DE | 0x06 |
| Set Power Limit | 43052 | 0-11000 (0.01%) | 0x06 |
| Set PF | 43053 | -1000 to +1000 | 0x06 |
| Force Charge | 43135 | 1 | 0x06 |
| Force Discharge | 43135 | 2 | 0x06 |
| Stop Force Charge/Discharge | 43135 | 0 | 0x06 |
| Set Max Charge Current | 43117 | 0.1A units | 0x06 |
| Set Max Discharge Current | 43118 | 0.1A units | 0x06 |
| Enable Time-of-Use | 43110 | Set BIT04 | 0x06 |

---

## 15. Unit Conversion Reference

| Unit in Protocol | Multiply By | To Get |
|------------------|-------------|--------|
| 0.1V | 0.1 | Volts |
| 0.01V | 0.01 | Volts |
| 0.1A | 0.1 | Amps |
| 0.01A | 0.01 | Amps |
| 1W | 1 | Watts |
| 10W | 10 | Watts |
| 0.1kWh | 0.1 | kWh |
| 0.01kWh | 0.01 | kWh |
| 1kWh | 1 | kWh |
| 0.01Hz | 0.01 | Hz |
| 0.1°C | 0.1 | Celsius |
| 0.001 (PF) | 0.001 | Power Factor |
| 0.01% | 0.01 | Percent |

---

## 16. Important Notes

1. **Register addresses are decimal** - The protocol document uses decimal addresses directly in the Modbus frame (no offset needed).

2. **Signed values (S16/S32)** - Use two's complement for negative values.

3. **32-bit values** - High word is at lower address, low word at higher address.

4. **Write operations** - Always read the current value first when modifying bit fields to preserve other bits.

5. **Timing** - Maintain minimum 300ms between frames. Wait for response before next command.

6. **Broadcast (0xFF)** - Write-only, no response expected.

7. **CRC** - Use CRC-16 (Modbus), high byte first in frame.

8. **Model-specific features** - Some registers only apply to certain inverter models (S5, S6, LV, HV, etc.).

---

*Document generated from Solis RS485_MODBUS RTU Hybrid Inverter Protocol Ver3.1*
