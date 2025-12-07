/* eslint-disable indent */
import * as Modbus from 'jsmodbus';

import { MRType, ModbusRegister } from './solis';

import { HelperService } from '../helper';
import { Measurement } from './measurement';

// eslint-disable-next-line import/prefer-default-export
export async function checkSolisRegisters(registers: Record<string, ModbusRegister>, client: InstanceType<typeof Modbus.client.TCP>) {
  const result: Record<string, Measurement> = {};

  const registersWithCapability = Object.keys(registers)
    .filter((key) => registers[key].capability !== undefined);

  for (const key of registersWithCapability) {
    const value = registers[key];
    await HelperService.delay(250);
    try {
      console.log(`reading ${value.type} register ${key}:`, value.addr, 'length:', value.len);

      let res;
      if (value.type === MRType.INPUT) {
        res = client.readInputRegisters(value.addr, value.len);
      } else if (value.type === MRType.HOLDING) {
        res = client.readHoldingRegisters(value.addr, value.len);
      } else {
        console.log(`Register type not supported for key: ${key}`);
        continue;
      }
      const actualRes = await res;
      const { response } = actualRes;
      const measurement: Measurement = {
        value: 'xxx',
        scale: value.scale,
        operation: value.operation,
        capability: value.capability!,
      };

      let resultValue: string = 'xxx';
      switch (value.dtype) {
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
          console.log(`${key}: type not found ${value.dtype}`);
          break;
      }
      console.log('= Result', resultValue);

      if (resultValue && resultValue !== undefined) {
        measurement.value = resultValue;
      }
      result[key] = measurement;
    } catch (err) {
      console.log(`error with key: ${key}`);
      console.log(err);
    }
  }

  console.log('checkRegister result');
  return result;
}
