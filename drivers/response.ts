import * as Modbus from 'jsmodbus';

/* eslint-disable indent */
import { MRType, ModbusRegister } from './solis';

import { HelperService } from '../helper';
import { Measurement } from './measurement';

export async function rawWrite(register: ModbusRegister, client: InstanceType<typeof Modbus.client.TCP>, value: number): Promise<void> {
  if (register.type === MRType.HOLDING) {
    const scaledValue = value * Math.pow(10, -register.scale);
    console.log(`= writing reg ${register.addr} with value: ${value} - ${scaledValue}`);
    await client.writeSingleRegister(register.addr, scaledValue);
    console.log(`= write response reg ${register.addr}`);
  } else {
    throw new Error(`Register type not supported for register: ${register.addr}`);
  }
}

export async function write(register: ModbusRegister, client: InstanceType<typeof Modbus.client.TCP>, value: number): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await rawWrite(register, client, value);
    } catch (error) {
      console.log(`= write attempt ${attempt} failed for reg ${register.addr}: ${(error as Error).message}`);
      if (attempt === 3) {
        throw error;
      }
      await HelperService.delay(500);
    }
  }

  throw new Error(`Attempt to write register ${register.addr} failed after 3 attempts`);
}

export async function read(register: ModbusRegister, client: InstanceType<typeof Modbus.client.TCP>): Promise<Measurement> {
  let res;
  if (register.type === MRType.INPUT) {
    res = client.readInputRegisters(register.addr, register.len);
  } else if (register.type === MRType.HOLDING) {
    res = client.readHoldingRegisters(register.addr, register.len);
  } else {
    throw new Error(`Register type not supported for register: ${register.addr}`);
  }

  const actualRes = await res;
  const { response } = actualRes;
  const measurement: Measurement = {
    value: 'xxx',
    computedValue: 'xxx',
    scale: register.scale,
    operation: register.operation,
    capability: register.capability!,
  };

  let resultValue: string = 'xxx';
  switch (register.dtype) {
    case 'STRING':
      resultValue = response.body.valuesAsBuffer.toString();
      break;
    case 'UINT16':
      resultValue = response.body.valuesAsBuffer.readUInt16BE().toString();
      break;
    case 'UINT32':
      resultValue = response.body.valuesAsBuffer.readUInt32BE().toString();
      break;
    case 'ACC32':
      resultValue = response.body.valuesAsBuffer.readUInt32BE().toString();
      break;
    case 'FLOAT':
      resultValue = response.body.valuesAsBuffer.readFloatBE().toString();
      break;
    case 'INT16':
      resultValue = response.body.valuesAsBuffer.readInt16BE().toString();
      break;
    case 'INT32':
      resultValue = response.body.valuesAsBuffer.readInt32BE().toString();
      break;
    case 'FLOAT32':
      resultValue = response.body.valuesAsBuffer.swap16().swap32().readFloatBE().toString();
      break;
    default:
      console.log(`Register ${register.addr}: type not found ${register.dtype}`);
      break;
  }

  if (resultValue && resultValue !== undefined) {
    measurement.value = resultValue;
  }

  return measurement;
}
