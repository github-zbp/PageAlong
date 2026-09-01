import { getAppNavigatorScreenOptions } from "@/lib/navigation";

it("uses the theme background for the navigation stack", () => {
  expect(getAppNavigatorScreenOptions("#F7F4ED")).toEqual({
    headerShown: false,
    contentStyle: {
      backgroundColor: "#F7F4ED"
    }
  });
});
