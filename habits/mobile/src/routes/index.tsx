import { NavigationContainer } from "@react-navigation/native";
import { View } from "react-native";

import { APPRoutes } from "./app.routes";

export function Routes() {
    return (
        <View className="flex-1 bg-background">
            <NavigationContainer>
                <APPRoutes />
            </NavigationContainer>
        </View>
    )
}