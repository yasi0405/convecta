module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module-resolver', {
        root: ['./'],
        alias: {
          '@/*': './src/*',
          '@amplify/*': './amplify/*',
          '@features/*': './src/features/*',
          '@components/*': './src/components/*',
          '@services/*': './src/services/*',
          '@constants/*': './src/constants/*',
          '@context/*': './src/context/*',
          '@domain/*': './src/domain/*',
        },
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
      }],
      'react-native-reanimated/plugin',
    ],
  };
};