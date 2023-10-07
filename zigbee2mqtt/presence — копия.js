const fz = require('zigbee-herdsman-converters/converters/fromZigbee');
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

const definition = {
    fingerprint: [
        { modelID: 'TS0601', manufacturerName: '_TZE204_sxm7l9xa' }
    ],
    model: 'TS0601_smart_human_presence_sensor',
    vendor: 'TuYa',
    description: 'Smart Human presence sensor',
    fromZigbee: [{
        cluster: 'manuSpecificTuya',
        type: ['commandDataResponse', 'commandDataReport'],
        convert: (model, msg, publish, options, meta) => {
            const dpValue = tuya.firstDpValue(msg, meta, 'tuya_smart_human_presense_sensor');
            const dp = dpValue.dp;
            const value = tuya.getDataValue(dpValue);
            let result = null;
            switch (dp) {
                case 105://tuya.dataPoints.tshpsPresenceState:
                    result = { presence: { 0: false, 1: true }[value] };
                    break;
                case 106://tuya.dataPoints.tshpscSensitivity:
                    result = { radar_sensitivity: value };
                    break;
                case 108://tuya.dataPoints.tshpsMinimumRange:
                    result = { minimum_range: value / 100 };
                    break;
                case 107://tuya.dataPoints.tshpsMaximumRange:
                    result = { maximum_range: value / 100 };
                    break;
                case 109://tuya.dataPoints.tshpsTargetDistance:
                    result = { target_distance: value / 100 };
                    break;
                case 110://tuya.dataPoints.tshpsDetectionDelay:
                    result = { detection_delay: value / 10 };
                    break;
                case 111://tuya.dataPoints.tshpsFadingTime:
                    result = { fading_time: value / 10 };
                    break;
                case 104://tuya.dataPoints.tshpsIlluminanceLux:
                    result = { illuminance_lux: value };
                    break;
                case tuya.dataPoints.tshpsCLI: // not recognize
                    result = { cli: value };
                    break;
                case tuya.dataPoints.tshpsSelfTest:
                    result = { self_test: tuya.tuyaHPSCheckingResult[value] };
                    break;
                default:
                    meta.logger
                        .warn(`fromZigbee.tuya_smart_human_presense_sensor: NOT RECOGNIZED DP ${dp} with data ${JSON.stringify(dpValue)}`);
            }
            return result;
        },
    }],
    toZigbee: [{
        key: ['radar_sensitivity', 'minimum_range', 'maximum_range', 'detection_delay', 'fading_time'],
        convertSet: async (entity, key, value, meta) => {
            switch (key) {
                case 'radar_sensitivity':
                    //await tuya.sendDataPointValue(entity, tuya.dataPoints.tshpscSensitivity, value);
                    await tuya.sendDataPointValue(entity, 106, value);
                    break;
                case 'minimum_range':
                    //await tuya.sendDataPointValue(entity, tuya.dataPoints.tshpsMinimumRange, value * 100);
                    await tuya.sendDataPointValue(entity, 108, value * 100);
                    break;
                case 'maximum_range':
                    //await tuya.sendDataPointValue(entity, tuya.dataPoints.tshpsMaximumRange, value * 100);
                    await tuya.sendDataPointValue(entity, 107, value * 100);
                    break;
                case 'detection_delay':
                    //await tuya.sendDataPointValue(entity, tuya.dataPoints.tshpsDetectionDelay, value * 10);
                    await tuya.sendDataPointValue(entity, 110, value * 10);
                    break;
                case 'fading_time':
                    //await tuya.sendDataPointValue(entity, tuya.dataPoints.tshpsFadingTime, value * 10);
                    await tuya.sendDataPointValue(entity, 111, value * 10);
                    break;
                default: // Unknown Key
                    meta.logger.warn(`toZigbee.tuya_smart_human_presense_sensor: Unhandled Key ${key}`);
            }
        },
    }],
    exposes: [
        e.illuminance_lux(), e.presence(),
        exposes.numeric('target_distance', ea.STATE).withDescription('Distance to target').withUnit('m'),
        exposes.numeric('radar_sensitivity', ea.STATE_SET).withValueMin(0).withValueMax(9).withValueStep(1)
            .withDescription('sensitivity of the radar'),
        exposes.numeric('minimum_range', ea.STATE_SET).withValueMin(0).withValueMax(9.5).withValueStep(0.15)
            .withDescription('Minimum range').withUnit('m'),
        exposes.numeric('maximum_range', ea.STATE_SET).withValueMin(0).withValueMax(9.5).withValueStep(0.15)
            .withDescription('Maximum range').withUnit('m'),
        exposes.numeric('detection_delay', ea.STATE_SET).withValueMin(0).withValueMax(10).withValueStep(0.1)
            .withDescription('Detection delay').withUnit('s'),
        exposes.numeric('fading_time', ea.STATE_SET).withValueMin(0).withValueMax(1500).withValueStep(1)
            .withDescription('Fading time').withUnit('s'),
        // exposes.text('cli', ea.STATE).withDescription('not recognize'),
        exposes.enum('self_test', ea.STATE, Object.values(tuya.tuyaHPSCheckingResult))
            .withDescription('Self_test, possible resuts: checking, check_success, check_failure, others, comm_fault, radar_fault.'),
    ],
    // meta: {
    //     tuyaDatapoints: [
    //         [104, 'illuminance', tuya.valueConverter.raw],
    //         [105, 'presence', tuya.valueConverter.trueFalse1],
    //         [106, 'radar_sensitivity', tuya.valueConverter.raw],
    //         [107, 'maximum_range', tuya.valueConverter.raw],
    //         [108, 'minimum_range', tuya.valueConverter.raw],
    //         [109, 'target_distance', tuya.valueConverter.raw],
    //         [110, 'detection_delay', tuya.valueConverter.raw],
    //         [111, 'fading_time', tuya.valueConverter.raw]
    //     ],
    // }
};

module.exports = definition;