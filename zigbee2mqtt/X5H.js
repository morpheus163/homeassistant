const fz = {...require('zigbee-herdsman-converters/converters/fromZigbee'), legacy: require('zigbee-herdsman-converters/lib/legacy').fromZigbee};
const tz = require('zigbee-herdsman-converters/converters/toZigbee');
const exposes = require('zigbee-herdsman-converters/lib/exposes');
const reporting = require('zigbee-herdsman-converters/lib/reporting');
const extend = require('zigbee-herdsman-converters/lib/extend');
const ota = require('zigbee-herdsman-converters/lib/ota');
const tuya = require('zigbee-herdsman-converters/lib/tuya');
const utils = require('zigbee-herdsman-converters/lib/utils');
const globalStore = require('zigbee-herdsman-converters/lib/store');
const e = exposes.presets;
const ea = exposes.access;


const x5h_set_time_request = {
    cluster: 'manuSpecificTuya',
    type: ['commandMcuSyncTime'],
    convert: async (model, msg, publish, options, meta) => {
        const currentTime = new Date().getTime();
        const utcTime = Math.round((currentTime) / 1000 ) - 4 * 3600;
        const localTime = Math.round(currentTime / 1000) - (new Date()).getTimezoneOffset() * 60;
        const endpoint = msg.endpoint;
        const payload = {
            payloadSize: 8,
            payload: [
                ...tuya.convertDecimalValueTo4ByteHexArray(utcTime),
                ...tuya.convertDecimalValueTo4ByteHexArray(localTime),
            ],
        };
        await endpoint.command('manuSpecificTuya', 'mcuSyncTime', payload, {});
    },
};

const tzDataPoints = {
    ...tuya.tzDataPoints,
    keys: ['system_mode', 'preset', 'running_state', 'current_heating_setpoint', 'upper_temperature', 'local_temperature', 'deadzone_temperature', 'heating_temperature_limit'],
}
const valueConverter = {
    systemMode: tuya.valueConverterBasic.lookup({'heat': true, 'off': false}),
    runningState: tuya.valueConverterBasic.lookup({'heat': true, 'idle': false}),
    preset: tuya.valueConverterBasic.lookup({'manual': 0, 'program': 1}),
    divideBy10: tuya.valueConverterBasic.divideBy(10),
};
const fzLocal = {
    x5h_thermostat: {
        cluster: 'manuSpecificTuya',
        type: ['commandDataResponse', 'commandDataReport'],
        convert: (model, msg, publish, options, meta) => {
            const dpValue = tuya.firstDpValue(msg, meta, 'x5h_thermostat');
            const dp = dpValue.dp;
            const value = tuya.getDataValue(dpValue);

            switch (dp) {
            case tuya.dataPoints.x5hState: {
                return {system_mode: value ? 'heat' : 'off'};
            }
            case tuya.dataPoints.x5hWorkingStatus: {
                return {running_state: value ? 'heat' : 'idle'};
            }
            case tuya.dataPoints.x5hSound: {
                return {sound: value ? 'ON' : 'OFF'};
            }
            case tuya.dataPoints.x5hFrostProtection: {
                return {frost_protection: value ? 'ON' : 'OFF'};
            }
            case tuya.dataPoints.x5hWorkingDaySetting: {
                return {week: tuya.thermostatWeekFormat[value]};
            }
            case tuya.dataPoints.x5hFactoryReset: {
                if (value) {
                    clearTimeout(globalStore.getValue(msg.endpoint, 'factoryResetTimer'));
                    const timer = setTimeout(() => publish({factory_reset: 'OFF'}), 60 * 1000);
                    globalStore.putValue(msg.endpoint, 'factoryResetTimer', timer);
                    meta.logger.info('The thermostat is resetting now. It will be available in 1 minute.');
                }

                return {factory_reset: value ? 'ON' : 'OFF'};
            }
            case tuya.dataPoints.x5hTempDiff: {
                return {deadzone_temperature: parseFloat((value / 10).toFixed(1))};
            }
            case tuya.dataPoints.x5hProtectionTempLimit: {
                return {heating_temp_limit: value};
            }
            case tuya.dataPoints.x5hBackplaneBrightness: {
                const lookup = {0: 'off', 1: 'low', 2: 'medium', 3: 'high'};

                if (value >= 0 && value <= 3) {
                    globalStore.putValue(msg.endpoint, 'brightnessState', value);
                    return {brightness_state: lookup[value]};
                }

                // Sometimes, for example on thermostat restart, it sends message like:
                // {"dpValues":[{"data":{"data":[90],"type":"Buffer"},"datatype":4,"dp":104}
                // It doesn't represent any brightness value and brightness remains the previous value
                const lastValue = globalStore.getValue(msg.endpoint, 'brightnessState') || 1;
                return {brightness_state: lookup[lastValue]};
            }
            case tuya.dataPoints.x5hWeeklyProcedure: {
                const periods = [];
                const periodSize = 4;
                const periodsNumber = 8;

                for (let i = 0; i < periodsNumber; i++) {
                    const hours = value[i * periodSize];
                    const minutes = value[i * periodSize + 1];
                    const tempHexArray = [value[i * periodSize + 2], value[i * periodSize + 3]];
                    const tempRaw = Buffer.from(tempHexArray).readUIntBE(0, tempHexArray.length);
                    const strHours = hours.toString().padStart(2, '0');
                    const strMinutes = minutes.toString().padStart(2, '0');
                    const temp = parseFloat((tempRaw / 10).toFixed(1));
                    periods.push(`${strHours}:${strMinutes}/${temp}`);
                }

                const schedule = periods.join(' ');
                return {schedule};
            }
            case tuya.dataPoints.x5hChildLock: {
                return {child_lock: value ? 'LOCK' : 'UNLOCK'};
            }
            case tuya.dataPoints.x5hSetTemp: {
                const setpoint = parseFloat((value / 10).toFixed(1));
                globalStore.putValue(msg.endpoint, 'currentHeatingSetpoint', setpoint);
                return {current_heating_setpoint: setpoint};
            }
            case tuya.dataPoints.x5hSetTempCeiling: {
                return {upper_temp: value};
            }
            case tuya.dataPoints.x5hCurrentTemp: {
                const temperature = value & (1 << 15) ? value - (1 << 16) + 1 : value;
                return {local_temperature: parseFloat((temperature / 10).toFixed(1))};
            }
            case tuya.dataPoints.x5hTempCorrection: {
                return {local_temperature_calibration: parseFloat((value / 10).toFixed(1))};
            }
            case tuya.dataPoints.x5hMode: {
                const lookup = {0: 'manual', 1: 'program'};
                return {preset: lookup[value]};
            }
            case tuya.dataPoints.x5hSensorSelection: {
                const lookup = {0: 'internal', 1: 'external', 2: 'both'};
                return {sensor: lookup[value]};
            }
            case tuya.dataPoints.x5hOutputReverse: {
                return {output_reverse: value};
            }
            default: {
                meta.logger.warn(`fromZigbee:x5h_thermostat: Unrecognized DP #${dp} with data ${JSON.stringify(dpValue)}`);
            }
            }
        },
    },
};   


const tzLocal = {
    x5h_thermostat: {
        key: ['system_mode', 'current_heating_setpoint', 'sensor', 'brightness_state', 'sound', 'frost_protection', 'week', 'factory_reset',
            'local_temperature_calibration', 'heating_temp_limit', 'deadzone_temperature', 'upper_temp', 'preset', 'child_lock',
            'schedule'],
        convertSet: async (entity, key, value, meta) => {
            switch (key) {
            case 'system_mode':
                await tuya.sendDataPointBool(entity, tuya.dataPoints.x5hState, value === 'heat');
                break;
            case 'preset': {
                value = value.toLowerCase();
                const lookup = {manual: 0, program: 1};
                utils.validateValue(value, Object.keys(lookup));
                value = lookup[value];
                await tuya.sendDataPointEnum(entity, tuya.dataPoints.x5hMode, value);
                break;
            }
            case 'upper_temp':
                if (value >= 35 && value <= 95) {
                    await tuya.sendDataPointValue(entity, tuya.dataPoints.x5hSetTempCeiling, value);
                    const setpoint = globalStore.getValue(entity, 'currentHeatingSetpoint', 20);
                    const setpointRaw = Math.round(setpoint * 10);
                    await new Promise((r) => setTimeout(r, 500));
                    await tuya.sendDataPointValue(entity, tuya.dataPoints.x5hSetTemp, setpointRaw);
                } else {
                    throw new Error('Supported values are in range [35, 95]');
                }
                break;
            case 'deadzone_temperature':
                if (value >= 0.5 && value <= 9.5) {
                    value = Math.round(value * 10);
                    await tuya.sendDataPointValue(entity, tuya.dataPoints.x5hTempDiff, value);
                } else {
                    throw new Error('Supported values are in range [0.5, 9.5]');
                }
                break;
            case 'heating_temp_limit':
                if (value >= 5 && value <= 60) {
                    await tuya.sendDataPointValue(entity, tuya.dataPoints.x5hProtectionTempLimit, value);
                } else {
                    throw new Error('Supported values are in range [5, 60]');
                }
                break;
            case 'local_temperature_calibration':
                if (value >= -9.9 && value <= 9.9) {
                    value = Math.round(value * 10);

                    if (value < 0) {
                        value = 0xFFFFFFFF + value + 1;
                    }

                    await tuya.sendDataPointValue(entity, tuya.dataPoints.x5hTempCorrection, value);
                } else {
                    throw new Error('Supported values are in range [-9.9, 9.9]');
                }
                break;
            case 'factory_reset':
                await tuya.sendDataPointBool(entity, tuya.dataPoints.x5hFactoryReset, value === 'ON');
                break;
            case 'week':
                await tuya.sendDataPointEnum(entity, tuya.dataPoints.x5hWorkingDaySetting,
                    utils.getKey(tuya.thermostatWeekFormat, value, value, Number));
                break;
            case 'frost_protection':
                await tuya.sendDataPointBool(entity, tuya.dataPoints.x5hFrostProtection, value === 'ON');
                break;
            case 'sound':
                await tuya.sendDataPointBool(entity, tuya.dataPoints.x5hSound, value === 'ON');
                break;
            case 'brightness_state': {
                value = value.toLowerCase();
                const lookup = {off: 0, low: 1, medium: 2, high: 3};
                utils.validateValue(value, Object.keys(lookup));
                value = lookup[value];
                await tuya.sendDataPointEnum(entity, tuya.dataPoints.x5hBackplaneBrightness, value);
                break;
            }
            case 'sensor': {
                value = value.toLowerCase();
                const lookup = {'internal': 0, 'external': 1, 'both': 2};
                utils.validateValue(value, Object.keys(lookup));
                value = lookup[value];
                await tuya.sendDataPointEnum(entity, tuya.dataPoints.x5hSensorSelection, value);
                break;
            }
            case 'current_heating_setpoint':
                if (value >= 5 && value <= 60) {
                    value = Math.round(value * 10);
                    await tuya.sendDataPointValue(entity, tuya.dataPoints.x5hSetTemp, value);
                } else {
                    throw new Error(`Unsupported value: ${value}`);
                }
                break;
            case 'child_lock':
                await tuya.sendDataPointBool(entity, tuya.dataPoints.x5hChildLock, value === 'LOCK');
                break;
            case 'schedule': {
                const periods = value.split(' ');
                const periodsNumber = 8;
                const payload = [];

                for (let i = 0; i < periodsNumber; i++) {
                    const timeTemp = periods[i].split('/');
                    const hm = timeTemp[0].split(':', 2);
                    const h = parseInt(hm[0]);
                    const m = parseInt(hm[1]);
                    const temp = parseFloat(timeTemp[1]);

                    if (h < 0 || h >= 24 || m < 0 || m >= 60 || temp < 5 || temp > 60) {
                        throw new Error('Invalid hour, minute or temperature of: ' + periods[i]);
                    }

                    const tempHexArray = tuya.convertDecimalValueTo2ByteHexArray(Math.round(temp * 10));
                    // 1 byte for hour, 1 byte for minutes, 2 bytes for temperature
                    payload.push(h, m, ...tempHexArray);
                }

                await tuya.sendDataPointRaw(entity, tuya.dataPoints.x5hWeeklyProcedure, payload);
                break;
            }
            default:
                break;
            }
        },
    },
}


const definition = {
    fingerprint: [{modelID: 'TS0601', manufacturerName: '_TZE200_2ekuz3dz'}],
    model: 'X5H-GB-B',
    vendor: 'TuYa',
    whiteLabel: [{vendor: 'Beok', model: 'TGR85-ZB'}],
    description: 'Wall-mount thermostat (EXTERNAL)',
    fromZigbee: [fz.ignore_basic_report, fzLocal.x5h_thermostat, x5h_set_time_request],
    toZigbee: [tzLocal.x5h_thermostat],
    configure: tuya.configureMagicPacket,
    meta: {
        tuyaDatapoints: [
            [1, 'system_mode', tuya.valueConverter.heatOff],
            [2, 'preset', tuya.valueConverterBasic.lookup({'manual': tuya.enum(0), 'program': tuya.enum(1)})],
            [3, 'running_state', tuya.valueConverter.heatIdle],
            [7, 'sound', tuya.valueConverter.onOff],
            [10, 'frost_protection', tuya.valueConverter.onOff],
            [16, 'current_heating_setpoint', tuya.valueConverter.divideBy10],
            [19, 'upper_temp', tuya.valueConverter.raw],
            [24, 'local_temperature', tuya.valueConverter.divideBy10],
            [27, 'local_temperature_calibration', tuya.valueConverter.localTempCalibration],
            [31, 'week', tuya.valueConverter.weekFormat],
            [39, 'factory_reset', tuya.valueConverter.onOff],
            [40, 'child_lock', tuya.valueConverter.lockUnlock],
            [43, 'sensor', tuya.valueConverterBasic.lookup({'internal': tuya.enum(0), 'external': tuya.enum(1), 'both': tuya.enum(2)})],
            [45, 'error', tuya.valueConverter.raw],
            [101, 'deadzone_temperature', tuya.valueConverter.divideBy10],
            [102, 'heating_temp_limit', tuya.valueConverter.raw],
            [103, 'output_reverse', tuya.valueConverter.onOff],
                // Sometimes, e.g., on thermostat restart, it sends a message like:
                // {"dpValues":[{"data":{"data":[90],"type":"Buffer"},"datatype":4,"dp":104}
                // It doesn't represent any brightness value, and brightness remains the previous value, so we need to ignore it
        ],
    },
    exposes: [
        exposes.climate().withSetpoint('current_heating_setpoint', 5, 30, 0.5, ea.STATE_SET)
            .withLocalTemperature(ea.STATE).withLocalTemperatureCalibration(-9.9, 9.9, 0.1, ea.STATE_SET)
            .withSystemMode(['off', 'heat'], ea.STATE_SET).withRunningState(['idle', 'heat'], ea.STATE)
            .withPreset(['manual', 'program'], ea.STATE_SET),
        exposes.text('schedule', ea.STATE_SET).withDescription('There are 8 periods in the schedule in total. ' +
            '6 for workdays and 2 for holidays. It should be set in the following format for each of the periods: ' +
            '`hours:minutes/temperature`. All periods should be set at once and delimited by the space symbol. ' +
            'For example: `06:00/20.5 08:00/15 11:30/15 13:30/15 17:00/22 22:00/15 06:00/20 22:00/15`. ' +
            'The thermostat doesn\'t report the schedule by itself even if you change it manually from device'),
        e.child_lock(), e.week(),
        exposes.enum('brightness_state', ea.STATE_SET, ['off', 'low', 'medium', 'high'])
            .withDescription('Screen brightness'),
        exposes.binary('sound', ea.STATE_SET, 'ON', 'OFF')
            .withDescription('Switches beep sound when interacting with thermostat'),
        exposes.binary('frost_protection', ea.STATE_SET, 'ON', 'OFF')
            .withDescription('Antifreeze function'),
        exposes.binary('factory_reset', ea.STATE_SET, 'ON', 'OFF')
            .withDescription('Resets all settings to default. Doesn\'t unpair device.'),
        exposes.numeric('heating_temp_limit', ea.STATE_SET).withUnit('°C').withValueMax(60)
            .withValueMin(5).withValueStep(1).withPreset('default', 35, 'Default value')
            .withDescription('Heating temperature limit'),
        exposes.numeric('deadzone_temperature', ea.STATE_SET).withUnit('°C').withValueMax(9.5)
            .withValueMin(0.5).withValueStep(0.5).withPreset('default', 1, 'Default value')
            .withDescription('The delta between local_temperature and current_heating_setpoint to trigger Heat'),
        exposes.numeric('upper_temp', ea.STATE_SET).withUnit('°C').withValueMax(95)
            .withValueMin(35).withValueStep(1).withPreset('default', 60, 'Default value'),
    ],
};

module.exports = definition;