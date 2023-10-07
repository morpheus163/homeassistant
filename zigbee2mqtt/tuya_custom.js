const exposes = require('zigbee-herdsman-converters/lib/exposes');
const fz = {...require('zigbee-herdsman-converters/converters/fromZigbee'), legacy: require('zigbee-herdsman-converters/lib/legacy').fromZigbee};
const tz = require('zigbee-herdsman-converters/converters/toZigbee');
const ota = require('zigbee-herdsman-converters/lib/ota');
const tuya = require('zigbee-herdsman-converters/lib/tuya');
const reporting = require('zigbee-herdsman-converters/lib/reporting');
const extend = require('zigbee-herdsman-converters/lib/extend');
const e = exposes.presets;
const ea = exposes.access;
const libColor = require('zigbee-herdsman-converters/lib/color');
const utils = require('zigbee-herdsman-converters/lib/utils');

module.exports = [
    {
        zigbeeModel: [
            'owvfni3\u0000', 'owvfni3', 'u1rkty3', 'aabybja', // Curtain motors
            'mcdj3aq', 'mcdj3aq\u0000', // Tubular motors
        ],
        fingerprint: [
            // Tubular motors:
            {modelID: 'TS0601', manufacturerName: '_TZE200_fzo2pocs'},
        ],
        model: 'TS0601_cover',
        vendor: 'TuYa',
        description: 'CUSTOM Curtain motor/roller blind motor/window pusher/tubular motor',
        whiteLabel: [
            {vendor: 'Zemismart', model: 'ZM25TQ', description: 'Tubular motor'},
        ],
        fromZigbee: [fz.tuya_cover, fz.ignore_basic_report],
        toZigbee: [tz.tuya_cover_control, tz.tuya_cover_options, tz.tuya_data_point_test],
        exposes: [
            e.cover_position().setAccess('position', ea.STATE_SET),
        ],
    },

];