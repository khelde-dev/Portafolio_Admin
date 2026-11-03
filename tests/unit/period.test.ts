import { describe, expect, it } from "vitest";
import {
	emptyPeriod,
	formatPeriod,
	MONTH_OPTIONS,
	parsePeriod,
	periodIssue,
	yearOptions,
} from "@/lib/period";

const period = (over: Partial<ReturnType<typeof emptyPeriod>> = {}) => ({
	...emptyPeriod(),
	...over,
});

describe("formatPeriod", () => {
	it("trabajo actual: «Actualidad / Present / Aujourd'hui»", () => {
		const p = period({ startMonth: "3", startYear: "2023", current: true });
		expect(formatPeriod(p, "es")).toBe("Mar 2023 - Actualidad");
		expect(formatPeriod(p, "en")).toBe("Mar 2023 - Present");
		expect(formatPeriod(p, "fr")).toBe("mars 2023 - Aujourd'hui");
	});

	it("rango cerrado, con meses de cada idioma", () => {
		const p = period({
			startMonth: "1",
			startYear: "2020",
			endMonth: "8",
			endYear: "2022",
		});
		expect(formatPeriod(p, "es")).toBe("Ene 2020 - Ago 2022");
		expect(formatPeriod(p, "en")).toBe("Jan 2020 - Aug 2022");
		expect(formatPeriod(p, "fr")).toBe("janv. 2020 - août 2022");
	});

	it("el mes es opcional: solo años", () => {
		expect(
			formatPeriod(period({ startYear: "2019", endYear: "2021" }), "es"),
		).toBe("2019 - 2021");
	});

	it("incompleto = texto vacio (no se puede guardar)", () => {
		expect(formatPeriod(period(), "es")).toBe("");
		expect(formatPeriod(period({ startYear: "2020" }), "es")).toBe("");
	});
});

describe("periodIssue", () => {
	it("pide el inicio, el fin o que siga vigente", () => {
		expect(periodIssue(period())).toBe("start");
		expect(periodIssue(period({ startYear: "2020" }))).toBe("end");
		expect(
			periodIssue(period({ startYear: "2020", current: true })),
		).toBeNull();
	});

	it("el fin no puede ser anterior al inicio", () => {
		expect(
			periodIssue(
				period({
					startMonth: "6",
					startYear: "2022",
					endMonth: "2",
					endYear: "2022",
				}),
			),
		).toBe("order");
		expect(
			periodIssue(period({ startYear: "2022", endYear: "2022" })),
		).toBeNull();
	});
});

describe("parsePeriod (lee lo que ya esta guardado)", () => {
	it.each([
		["2023 - Actualidad", { startYear: "2023", current: true }],
		[
			"Ene 2023 - Actualidad",
			{ startMonth: "1", startYear: "2023", current: true },
		],
		[
			"Jan 2020 - Mar 2022",
			{
				startMonth: "1",
				startYear: "2020",
				endMonth: "3",
				endYear: "2022",
			},
		],
		[
			"janv. 2021 - août 2022",
			{
				startMonth: "1",
				startYear: "2021",
				endMonth: "8",
				endYear: "2022",
			},
		],
		["2019 - 2021", { startYear: "2019", endYear: "2021" }],
		[
			"Mar 2023 – Present",
			{ startMonth: "3", startYear: "2023", current: true },
		],
	])("%s", (text, expected) => {
		expect(parsePeriod(text)).toEqual(period(expected));
	});

	it("lo que no se entiende da null y no se toca", () => {
		for (const text of [
			"",
			null,
			undefined,
			"hace unos años",
			"2020",
			"Foo 2020 - 2021",
			"2020 - 2021 - 2022",
			"2020 - ya",
		]) {
			expect(parsePeriod(text)).toBeNull();
		}
	});

	it("ida y vuelta: lo que se formatea se vuelve a leer igual", () => {
		const p = period({
			startMonth: "11",
			startYear: "2018",
			endMonth: "4",
			endYear: "2021",
		});
		for (const locale of ["es", "en", "fr"] as const) {
			expect(parsePeriod(formatPeriod(p, locale))).toEqual(p);
		}
	});
});

describe("opciones", () => {
	it("12 meses y años de más nuevo a más viejo", () => {
		expect(MONTH_OPTIONS).toHaveLength(12);
		const years = yearOptions(2026, 2024);
		expect(years.map((y) => y.value)).toEqual(["2026", "2025", "2024"]);
	});
});
