const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const postcssCustomProperties = require('postcss-custom-properties');

module.exports = {
    mode: 'production',
    entry: ['./src/index.js', './src/style.css'],
    output: {
        filename: 'main.js',
        path: path.resolve(__dirname, 'docs'),
    },
    devtool: 'source-map',
    devServer: {
        contentBase: './docs',
    },
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: [MiniCssExtractPlugin.loader,
                    { loader: 'css-loader', options: { importLoaders: 1 } },
                    { loader: 'postcss-loader', options: {
                            postcssOptions: {
                                plugins: () => [
                                    postcssCustomProperties({
                                        preverve: false
                                    })
                                ]
                            }
                        }
                    }
                ],
            },
        ],
    },
    plugins: [
        new webpack.ProgressPlugin(),
        new MiniCssExtractPlugin(),
    ],
    optimization: {
        minimizer: [
            `...`,
            new MiniCssExtractPlugin(),
        ],
    },
};