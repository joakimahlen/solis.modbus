# Solis Modbus TCP - Homey App

## Overview

This is a Homey app designed to control Solis inverters directly through Modbus TCP. It exposes inverter capabilities for monitoring and control through Homey's interface and flow automation.

## Purpose

The app provides two levels of control:

1. **Direct Register Access**: Read/write Modbus registers to monitor and control inverter parameters
2. **High-Level Mode Control**: A simplified mode system called `ForceBatteryChargeMode` that abstracts complex register configurations into easy-to-use modes

The primary goal of the mode system is to **disable the inverter's built-in "intelligence"** and enable **complete manual control** over battery charging and discharging behavior.

## ForceBatteryChargeMode

When a mode is selected, the app sets a predefined combination of registers to configure the inverter for that specific behavior:

| Mode | Purpose | Key Behavior |
|------|---------|--------------|
| **SELF_USE** | Normal operation | Inverter uses its built-in logic; passive mode disabled |
| **PEAK_SHAVING** | Limit grid import | Discharge battery to keep grid import below configured limit |
| **CHARGE** | Force battery charging | Charge at configured power from grid and/or PV |
| **DISCHARGE** | Force battery discharging | Discharge at configured power to house load |
| **IDLE** | Battery standby | No charging or discharging; battery remains at current SOC |

### Register Configuration by Mode

All manual modes (CHARGE, DISCHARGE, IDLE, PEAK_SHAVING) enable passive mode (`43311 = 0xaa55`) to override built-in inverter logic. SELF_USE mode disables passive mode to restore normal operation.

Key registers controlled:
- `43110` - Storage control mode flags
- `43311` - Passive mode enable/disable
- `43135` - Force charge direction (OFF/CHARGE/DISCHARGE)
- `43136` - Force charge power (W)
- `43129` - Force discharge power (W)

## Project Structure

```
drivers/
  solis.ts           # Core Solis class with all register definitions and mode logic
  basedevice.ts      # Abstract base with Modbus TCP connection management
  response.ts        # Modbus read/write helpers
  solis/             # Basic inverter driver (no battery)
  soliswithbatt/     # Battery-equipped inverter driver
```

## Key Files

- [solis.ts](drivers/solis.ts) - Contains `ForceBatteryChargeMode` enum, register definitions, and `rewriteChargeModeSetting()` which implements the mode logic
- [basedevice.ts](drivers/basedevice.ts) - Modbus TCP socket management and polling loop
- [app.json](app.json) - Capability definitions and Homey flow configurations

## Documentation

- [Solis Hybrid Inverter Modbus Protocol](docs/SOLIS_HYBRID_INVERTER_MODBUS_PROTOCOL.md) - Modbus register documentation for Solis hybrid inverters

## Modbus Connection

- Uses `jsmodbus` library over TCP
- Default port: 1502
- Supports Modbus unit IDs 0-50
- Auto-reconnect on connection loss
- Multi-priority polling (10s/60s/120s/24h intervals)

## Capabilities

The battery driver exposes ~40 capabilities including:
- Battery SOC and power
- Force charge mode selection and power settings
- Grid import/export power and energy
- PV power per string
- House load
- Various status indicators

All capabilities are available for Homey flows (triggers, conditions, actions).
