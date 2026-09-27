import { Component, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Home from "./app/index";

type Props = { children: ReactNode };
type State = { error: Error | null };

class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("RP Exchange render error:", error);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.safe}>
        <View style={styles.card}>
          <Text style={styles.title}>RP Exchange</Text>
          <Text style={styles.heading}>App error</Text>
          <Text style={styles.message}>
            The app encountered an internal error. Your login and account data have not been cleared.
          </Text>
          <Text style={styles.detail} numberOfLines={4}>
            {this.state.error.message}
          </Text>
          <Pressable
            style={styles.button}
            onPress={() => this.setState({ error: null })}
          >
            <Text style={styles.buttonText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <Home />
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F8FB", alignItems: "center", justifyContent: "center", padding: 20 },
  card: { width: "100%", maxWidth: 420, backgroundColor: "#FFFFFF", borderRadius: 20, padding: 22, borderWidth: 1, borderColor: "#E7E9EF" },
  title: { fontSize: 14, fontWeight: "800", color: "#2455D6", marginBottom: 18 },
  heading: { fontSize: 25, fontWeight: "900", color: "#17191F" },
  message: { fontSize: 13, lineHeight: 19, color: "#7B7F89", marginTop: 9 },
  detail: { fontSize: 11, lineHeight: 16, color: "#17191F", marginTop: 14, backgroundColor: "#F7F8FB", padding: 10, borderRadius: 10 },
  button: { marginTop: 16, height: 48, borderRadius: 12, backgroundColor: "#2455D6", alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#FFFFFF", fontWeight: "800" },
});
