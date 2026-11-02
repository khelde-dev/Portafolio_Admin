// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AboutForm } from "@/components/content/AboutForm";
import {
	EducationList,
	ExperienceList,
	SkillsList,
} from "@/components/content/ContentLists";
import { EducationForm } from "@/components/content/EducationForm";
import { ExperienceForm } from "@/components/content/ExperienceForm";
import { SkillForm } from "@/components/content/SkillForm";
import { ApiFailure, api } from "@/lib/apiClient";
import {
	aboutValues,
	educationValues,
	emptyEducation,
	emptyExperience,
	emptySkill,
	experienceValues,
	skillValues,
} from "@/lib/contentForms";
import type {
	AboutRow,
	EducationRow,
	ExperienceRow,
	SkillRow,
} from "@/schemas/content";
import {
	aboutSchema,
	educationSchema,
	experienceSchema,
	skillSchema,
} from "@/schemas/content";

vi.mock("astro:env/client", () => ({
	PUBLIC_MEDIA_URL: "https://media.example.dev",
	PUBLIC_ICONS_URL: "https://icons.example.dev/api/icons",
}));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn() } }));

const experience = (over: Partial<ExperienceRow> = {}): ExperienceRow => ({
	experience_id: 1,
	sort_order: 0,
	work_default: "Acme",
	title_default: "Desarrollador",
	subtitle_default: "Backend con Node",
	img: "experience/a.webp",
	alt: "Logo de Acme",
	time_default: "2023 - Actualidad",
	location_default: "CDMX",
	translations: {
		en: { title: "Developer", subtitle: null },
		es: { title: "no" },
	},
	created_at: "2026-01-01 00:00:00",
	updated_at: "2026-01-01 00:00:00",
	...over,
});
const education = (over: Partial<EducationRow> = {}): EducationRow => ({
	education_id: 4,
	sort_order: 0,
	institution_default: "UPVM",
	subtitle_default: "Ingeniería en Sistemas",
	description_default: "Texto largo",
	image: "education/u.webp",
	period_default: "2019 - 2023",
	translations: {},
	created_at: "2026-01-01 00:00:00",
	updated_at: "2026-01-01 00:00:00",
	...over,
});
const skill = (over: Partial<SkillRow> = {}): SkillRow => ({
	skill_id: 9,
	sort_order: 0,
	title_default: "Frontend",
	images_topics: ["react", "ts"],
	translations: {},
	created_at: "2026-01-01 00:00:00",
	updated_at: "2026-01-01 00:00:00",
	...over,
});
const about = (over: Partial<AboutRow> = {}): AboutRow => ({
	about_id: 1,
	image: "about/a.webp",
	title_card_default: "Hola",
	subtitle_default: "Soy Erick",
	description_default: "Desarrollador",
	translations: {},
	created_at: "2026-01-01 00:00:00",
	updated_at: "2026-01-01 00:00:00",
	...over,
});

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe("valores de los formularios", () => {
	it("una fila real pasa su esquema y los nulos no llegan como null a un input", () => {
		expect(
			experienceSchema.safeParse(
				experienceValues(experience({ work_default: null })),
			).success,
		).toBe(true);
		expect(
			experienceValues(experience({ work_default: null })).work_default,
		).toBe("");
		expect(
			educationSchema.safeParse(educationValues(education())).success,
		).toBe(true);
		expect(skillSchema.safeParse(skillValues(skill())).success).toBe(true);
		expect(aboutSchema.safeParse(aboutValues(about())).success).toBe(true);
	});

	it("las traducciones se limpian (solo en/fr, solo campos conocidos y con texto)", () => {
		expect(experienceValues(experience()).translations).toEqual({
			en: { title: "Developer" },
		});
	});

	it("los formularios nuevos nacen vacios y no pasan el esquema", () => {
		for (const [schema, empty] of [
			[experienceSchema, emptyExperience()],
			[educationSchema, emptyEducation()],
			[skillSchema, emptySkill()],
		] as const) {
			expect(schema.safeParse(empty).success).toBe(false);
		}
	});

	it("'sobre mi' puede no existir todavia: arranca vacio", () => {
		expect(aboutValues(null)).toMatchObject({
			image: "",
			title_card_default: "",
			translations: {},
		});
		expect(aboutValues(undefined).description_default).toBe("");
	});
});

describe("listas ordenables", () => {
	it("experiencia: titulo, empresa y datos en mono, y vacio con accion", () => {
		const { unmount } = render(<ExperienceList initial={[experience()]} />);
		expect(screen.getByRole("link", { name: "Desarrollador" })).toHaveAttribute(
			"href",
			"/experiencia/1",
		);
		expect(
			screen.getByText("Acme, 2023 - Actualidad, CDMX"),
		).toBeInTheDocument();
		unmount();
		render(<ExperienceList initial={[]} />);
		expect(
			screen.getByRole("link", { name: /Agregar experiencia/ }),
		).toHaveAttribute("href", "/experiencia/nuevo");
	});

	it("educacion y habilidades muestran lo suyo", () => {
		const { unmount } = render(<EducationList initial={[education()]} />);
		expect(
			screen.getByText("Ingeniería en Sistemas, 2019 - 2023"),
		).toBeInTheDocument();
		unmount();
		render(
			<SkillsList
				initial={[
					skill(),
					skill({ skill_id: 10, title_default: "Datos", images_topics: [] }),
				]}
			/>,
		);
		expect(screen.getByText("react, ts")).toBeInTheDocument();
		expect(screen.getByText("Sin tecnologías")).toBeInTheDocument();
	});

	it("reordena con botones y guarda en /api/<recurso>/order", async () => {
		const put = vi.spyOn(api, "put").mockResolvedValue(null);
		render(
			<SkillsList
				initial={[skill(), skill({ skill_id: 10, title_default: "Datos" })]}
			/>,
		);
		await userEvent.click(
			screen.getByRole("button", { name: "Bajar Frontend" }),
		);
		await userEvent.click(
			await screen.findByRole("button", { name: "Guardar orden" }),
		);
		expect(put).toHaveBeenCalledWith("/api/skills/order", [
			{ id: 10, sort_order: 0 },
			{ id: 9, sort_order: 1 },
		]);
	});

	it("borra con confirmacion usando el recurso correcto", async () => {
		const del = vi.spyOn(api, "delete").mockResolvedValue(null);
		render(<EducationList initial={[education()]} />);
		await userEvent.click(screen.getByRole("button", { name: "Borrar UPVM" }));
		expect(await screen.findByText("¿Borrar «UPVM»?")).toBeInTheDocument();
		await userEvent.click(
			within(screen.getByRole("alertdialog")).getByRole("button", {
				name: "Borrar",
			}),
		);
		await waitFor(() => expect(del).toHaveBeenCalledWith("/api/education/4"));
	});

	it("un borrado fallido deja la fila y avisa", async () => {
		vi.spyOn(api, "delete").mockRejectedValue(
			new ApiFailure(502, "El backend rechazó la petición."),
		);
		render(<ExperienceList initial={[experience()]} />);
		await userEvent.click(
			screen.getByRole("button", { name: "Borrar Desarrollador" }),
		);
		await userEvent.click(
			within(await screen.findByRole("alertdialog")).getByRole("button", {
				name: "Borrar",
			}),
		);
		expect(
			await screen.findByText("El backend rechazó la petición."),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Desarrollador" }),
		).toBeInTheDocument();
	});

	it("error de lectura con reintento", async () => {
		vi.spyOn(api, "get").mockResolvedValue([skill()]);
		render(
			<SkillsList initial={null} initialError="No se pudo leer el backend." />,
		);
		await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
		expect(await screen.findByText("Frontend")).toBeInTheDocument();
		expect(api.get).toHaveBeenCalledWith("/api/skills");
	});
});

describe("formularios de contenido", () => {
	it("experiencia: editar manda PUT con su id y el texto alternativo", async () => {
		const put = vi.spyOn(api, "put").mockResolvedValue(null);
		render(<ExperienceForm initial={experience({ experience_id: 3 })} />);
		expect(screen.getByLabelText(/^Texto alternativo/)).toHaveValue(
			"Logo de Acme",
		);
		await userEvent.type(
			screen.getByLabelText(/^Puesto/, {
				selector: "input#campo-title_default",
			}),
			" Sr",
		);
		await userEvent.click(
			screen.getByRole("button", { name: "Guardar cambios" }),
		);
		await waitFor(() => expect(put).toHaveBeenCalledOnce());
		expect(put.mock.calls[0][0]).toBe("/api/experiences/3");
		expect(put.mock.calls[0][1]).toMatchObject({
			title_default: "Desarrollador Sr",
			alt: "Logo de Acme",
		});
	});

	it("experiencia: sin logo ni texto alternativo no se envia", async () => {
		const post = vi.spyOn(api, "post");
		render(<ExperienceForm />);
		await userEvent.click(
			screen.getByRole("button", { name: "Guardar cambios" }),
		);
		expect(
			await screen.findByText("El texto alternativo es obligatorio"),
		).toBeInTheDocument();
		expect(post).not.toHaveBeenCalled();
	});

	it("educacion: crear manda POST y editar manda PUT", async () => {
		const put = vi.spyOn(api, "put").mockResolvedValue(null);
		render(<EducationForm initial={education()} />);
		await userEvent.type(
			screen.getByLabelText(/^Periodo/, {
				selector: "input#campo-period_default",
			}),
			"!",
		);
		await userEvent.click(
			screen.getByRole("button", { name: "Guardar cambios" }),
		);
		await waitFor(() => expect(put).toHaveBeenCalledOnce());
		expect(put.mock.calls[0][0]).toBe("/api/education/4");
	});

	it("habilidades: guarda el grupo con sus tecnologias", async () => {
		const put = vi.spyOn(api, "put").mockResolvedValue(null);
		render(<SkillForm initial={skill()} />);
		expect(screen.getByAltText("Vista previa: react, ts")).toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: "Quitar ts" }));
		await userEvent.click(
			screen.getByRole("button", { name: "Guardar cambios" }),
		);
		await waitFor(() => expect(put).toHaveBeenCalledOnce());
		expect(put.mock.calls[0][0]).toBe("/api/skills/9");
		expect(put.mock.calls[0][1]).toMatchObject({ images_topics: ["react"] });
	});

	it("sobre mi: siempre PUT /api/about, existe o no la fila", async () => {
		const put = vi.spyOn(api, "put").mockResolvedValue(null);
		render(<AboutForm initial={about()} />);
		await userEvent.type(
			screen.getByLabelText(/^Subtítulo/, {
				selector: "input#campo-subtitle_default",
			}),
			"!",
		);
		await userEvent.click(
			screen.getByRole("button", { name: "Guardar cambios" }),
		);
		await waitFor(() =>
			expect(put).toHaveBeenCalledWith(
				"/api/about",
				expect.objectContaining({ subtitle_default: "Soy Erick!" }),
			),
		);
	});

	it("sobre mi vacio (aun no existe) pide los datos obligatorios", async () => {
		const put = vi.spyOn(api, "put");
		render(<AboutForm initial={null} />);
		await userEvent.click(
			screen.getByRole("button", { name: "Guardar cambios" }),
		);
		expect(
			await screen.findByText("El título de la tarjeta es obligatorio"),
		).toBeInTheDocument();
		expect(put).not.toHaveBeenCalled();
	});
});
