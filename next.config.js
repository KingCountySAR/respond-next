/** @type {import('next').NextConfig} */

const { determineBuildId } = require('./buildId')

const nextConfig = {
  experimental: {
    appDir: true,
  },
  generateBuildId: async () => {
    const buildId = await determineBuildId()
    console.log(`> Build ID: ${buildId}`)
    return buildId
  },
  modularizeImports: {
    '@mui/material': {
      transform: '@mui/material/{{member}}'
    },
    '@mui/icons-material': {
      transform: '@mui/icons-material/{{member}}'
    }
  },
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    config.plugins.push(
      new webpack.DefinePlugin({
        'process.env.CONFIG_BUILD_ID': JSON.stringify(buildId)
      })
    );
    return config;
  }
}

module.exports = nextConfig