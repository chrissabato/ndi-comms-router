const path = require('path');

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  target: 'electron-preload',
  entry: './src/main/preload.js',
  output: {
    filename: 'preload.js',
    path: path.resolve(__dirname, 'dist'),
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
    electron: 'commonjs electron',
  },
  node: {
    __dirname: false,
    __filename: false,
  },
  devtool: process.env.NODE_ENV === 'production' ? false : 'source-map',
};
