const path = require("path");

const src = path.resolve(__dirname, "src");
const dist = path.resolve(__dirname, "dist");

module.exports = {
  mode: "development",
  entry: "./src/index.js", // Changed to JavaScript entry point
  devtool: "inline-source-map",
  module: {
    rules: [
      {
        test: /\.js$/, // Changed to handle JavaScript files
        exclude: /node_modules/,
        use: {
          loader: "babel-loader", // Use Babel to transpile JavaScript
          options: {
            presets: ["@babel/preset-env"], // Use Babel preset for modern JavaScript
          },
        },
      },
    ],
  },
  resolve: {
    extensions: [".js"], // Only resolve JavaScript files
  },
  output: {
    filename: "index.js",
    path: dist,
  },
  devServer: {
    static: {
      directory: dist, // Correct configuration for serving static files
    },
    compress: true,
    port: 9000, // Optional: specify the port for the dev server
  },
};
