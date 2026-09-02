import { Image, type ImageStyle, type StyleProp } from "react-native";

const brandMarkSource = require("../../assets/logo/web_reader-logo.png");

export function BrandMark({
  size = 40,
  style
}: {
  size?: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      accessible={false}
      resizeMode="contain"
      source={brandMarkSource}
      style={[{ height: size, width: size }, style]}
    />
  );
}

export default BrandMark;
