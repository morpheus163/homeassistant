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

const tzDatapoints = {
    ...tuya.tz.datapoints,
    key: [...tuya.tz.datapoints.key, 'minimum_range', 'maximum_range', 'detection_delay', 'fading_time']
}

const definition = {
    fingerprint: tuya.fingerprint('TS0601', ['_TZE204_sxm7l9xa']),
    model: 'TS0601_smart_human_presence_sensor',
    vendor: 'TuYa',
    description: 'Smart Human presence sensor',
    fromZigbee: [tuya.fz.datapoints],
    toZigbee: [tzDatapoints],
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
        exposes.numeric('fading_time', ea.STATE_SET).withValueMin(0.5).withValueMax(1500).withValueStep(1)
            .withDescription('Fading time').withUnit('s'),
    ],
    meta: {
        tuyaDatapoints: [
            [104, 'illuminance_lux', tuya.valueConverter.raw],
            [105, 'presence', tuya.valueConverter.trueFalse1],
            [106, 'radar_sensitivity', tuya.valueConverter.raw],
            [107, 'maximum_range', tuya.valueConverter.divideBy100],
            [108, 'minimum_range', tuya.valueConverter.divideBy100],
            [109, 'target_distance', tuya.valueConverter.divideBy100],
            [110, 'fading_time', tuya.valueConverter.divideBy10],
            [111, 'detection_delay', tuya.valueConverter.divideBy10],
        ],
    }
};

module.exports = definition;