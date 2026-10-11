import { NativeTabs } from "expo-router/unstable-native-tabs";
export default function Tabs() {
  return (
    <NativeTabs backgroundColor="#F6F3EA" indicatorColor="#DCEBC7">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Learn</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require("@/assets/images/tabIcons/home.png")}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="practice">
        <NativeTabs.Trigger.Label>Practice</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require("@/assets/images/tabIcons/explore.png")}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
