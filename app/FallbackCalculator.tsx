import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const C = {
  bg: "#F7F8FB",
  card: "#FFFFFF",
  text: "#17191F",
  muted: "#7B7F89",
  blue: "#2455D6",
  border: "#E7E9EF",
};

type Operator = "+" | "-" | "×" | "÷" | null;

export default function FallbackCalculator() {
  const [display, setDisplay] = useState("0");
  const [stored, setStored] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator>(null);
  const [waiting, setWaiting] = useState(false);

  const inputDigit = (digit: string) => {
    if (waiting) {
      setDisplay(digit);
      setWaiting(false);
      return;
    }

    setDisplay((current) => {
      if (current === "0") return digit;
      if (current.replace("-", "").replace(".", "").length >= 12) return current;
      return current + digit;
    });
  };

  const inputDecimal = () => {
    if (waiting) {
      setDisplay("0.");
      setWaiting(false);
      return;
    }
    setDisplay((current) => (current.includes(".") ? current : current + "."));
  };

  const clear = () => {
    setDisplay("0");
    setStored(null);
    setOperator(null);
    setWaiting(false);
  };

  const calculate = (left: number, right: number, op: Operator) => {
    if (op === "+") return left + right;
    if (op === "-") return left - right;
    if (op === "×") return left * right;
    if (op === "÷") return right === 0 ? null : left / right;
    return right;
  };

  const chooseOperator = (nextOperator: Exclude<Operator, null>) => {
    const current = Number(display);

    if (!Number.isFinite(current)) {
      clear();
      return;
    }

    if (stored !== null && operator && !waiting) {
      const result = calculate(stored, current, operator);
      if (result === null) {
        Alert.alert("Cannot divide by zero");
        clear();
        return;
      }
      setDisplay(formatNumber(result));
      setStored(result);
    } else {
      setStored(current);
    }

    setOperator(nextOperator);
    setWaiting(true);
  };

  const equals = () => {
    if (stored === null || operator === null) return;

    const result = calculate(stored, Number(display), operator);
    if (result === null) {
      Alert.alert("Cannot divide by zero");
      clear();
      return;
    }

    setDisplay(formatNumber(result));
    setStored(null);
    setOperator(null);
    setWaiting(true);
  };

  const toggleSign = () => {
    if (display === "0") return;
    setDisplay((current) => (current.startsWith("-") ? current.slice(1) : "-" + current));
  };

  const percent = () => {
    const value = Number(display);
    if (!Number.isFinite(value)) return;
    setDisplay(formatNumber(value / 100));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.icon}>
            <Ionicons name="calculator-outline" size={25} color={C.blue} />
          </View>
          <View>
            <Text style={styles.title}>Calculator</Text>
            <Text style={styles.subtitle}>Utility mode</Text>
          </View>
        </View>

        <View style={styles.displayCard}>
          <Text style={styles.displayLabel}>CALCULATOR</Text>
          <Text style={styles.display} numberOfLines={1} adjustsFontSizeToFit>
            {display}
          </Text>
        </View>

        <View style={styles.pad}>
          <CalcButton label="AC" onPress={clear} secondary />
          <CalcButton label="+/-" onPress={toggleSign} secondary />
          <CalcButton label="%" onPress={percent} secondary />
          <CalcButton label="÷" onPress={() => chooseOperator("÷")} operator={operator === "÷"} />

          <CalcButton label="7" onPress={() => inputDigit("7")} />
          <CalcButton label="8" onPress={() => inputDigit("8")} />
          <CalcButton label="9" onPress={() => inputDigit("9")} />
          <CalcButton label="×" onPress={() => chooseOperator("×")} operator={operator === "×"} />

          <CalcButton label="4" onPress={() => inputDigit("4")} />
          <CalcButton label="5" onPress={() => inputDigit("5")} />
          <CalcButton label="6" onPress={() => inputDigit("6")} />
          <CalcButton label="-" onPress={() => chooseOperator("-")} operator={operator === "-"} />

          <CalcButton label="1" onPress={() => inputDigit("1")} />
          <CalcButton label="2" onPress={() => inputDigit("2")} />
          <CalcButton label="3" onPress={() => inputDigit("3")} />
          <CalcButton label="+" onPress={() => chooseOperator("+")} operator={operator === "+"} />

          <CalcButton label="0" onPress={() => inputDigit("0")} wide />
          <CalcButton label="." onPress={inputDecimal} />
          <CalcButton label="=" onPress={equals} equals />
        </View>

        <Text style={styles.footer}>Utility mode</Text>
      </View>
    </SafeAreaView>
  );
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round((value + Number.EPSILON) * 1e10) / 1e10;
  return String(rounded);
}

function CalcButton({
  label,
  onPress,
  secondary,
  operator,
  equals,
  wide,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  operator?: boolean;
  equals?: boolean;
  wide?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.button,
        wide && styles.wideButton,
        secondary && styles.secondaryButton,
        operator && styles.operatorButton,
        equals && styles.equalsButton,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          secondary && styles.secondaryText,
          (operator || equals) && styles.actionText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  title: { fontSize: 24, fontWeight: "900", color: C.text },
  subtitle: { fontSize: 12, color: C.muted, marginTop: 2 },
  displayCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 14,
    minHeight: 125,
    justifyContent: "flex-end",
  },
  displayLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: C.muted,
    letterSpacing: 1,
    marginBottom: 10,
  },
  display: {
    fontSize: 42,
    fontWeight: "800",
    color: C.text,
    textAlign: "right",
  },
  pad: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  button: {
    width: "22.5%",
    aspectRatio: 1,
    borderRadius: 17,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  wideButton: {
    width: "48.5%",
    aspectRatio: 2.15,
  },
  secondaryButton: { backgroundColor: "#EEF1F5" },
  operatorButton: { backgroundColor: C.blue, borderColor: C.blue },
  equalsButton: { backgroundColor: "#151A38", borderColor: "#151A38" },
  buttonText: { fontSize: 21, fontWeight: "800", color: C.text },
  secondaryText: { color: C.muted },
  actionText: { color: "#FFFFFF" },
  footer: {
    textAlign: "center",
    color: C.muted,
    fontSize: 11,
    marginTop: 16,
  },
});
