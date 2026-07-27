export type DemoModel = {
  id: string;
  label: string;
  relativePath: string;
  fileName: string;
};

export const DEMO_MODELS: DemoModel[] = [
  {
    id: "d20",
    label: "D20",
    relativePath: "obj/D20.obj",
    fileName: "D20.obj",
  },
  {
    id: "cube",
    label: "Cube",
    relativePath: "stl/Cube.stl",
    fileName: "Cube.stl",
  },
  {
    id: "big-m",
    label: "Big_M",
    relativePath: "obj/Big_M.obj",
    fileName: "Big_M.obj",
  },
];

const demoModelById = new Map(DEMO_MODELS.map((model) => [model.id, model]));

export function getDemoModelById(id: string): DemoModel | undefined {
  return demoModelById.get(id);
}
