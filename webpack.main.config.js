const path = require('path');

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  target: 'electron-main',
  entry: './src/main/index.js',
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist/main'),
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: { loader: 'babel-loader' },
      },
    ],
  },
  resolve: {
    extensions: ['.js'],
  },
  externals: {
    // Native modules must not be bundled
    naudiodon: 'commonjs naudiodon',
    grandiose: 'commonjs grandiose',
    electron: 'commonjs electron',
    'electron-updater': 'commonjs electron-updater',
  },
  node: {
    __dirname: false,
    __filename: false,
  },
  devtool: process.env.NODE_ENV === 'production' ? false : 'source-map',
};
