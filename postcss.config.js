const postcssPresetEnv = require('postcss-preset-env');
const cssnano = require('cssnano');

module.exports = {
    plugins: [
        postcssPresetEnv({
            stage: 1,
            features: {
                'nesting-rules': true
            }
        }),
        cssnano({
            presets: ["default", {svgo: false}]
        })
    ]
}