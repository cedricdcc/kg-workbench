import dagre from "dagre"
import type {
  ImportClass,
  ImportOntology,
  ImportRelation,
} from "@/features/ontology/schemas/import"

type ImportOntologyVisual = NonNullable<ImportOntology["visual"]>

const CLASS_NODE_WIDTH = 220
const CLASS_NODE_HEIGHT = 100
const PADDING = 40

export function computeOntologyDagreLayout(
  classes: ImportClass[],
  relations: ImportRelation[] = [],
  moduleName: string,
  moduleId?: string
): ImportOntologyVisual {
  if (classes.length === 0) {
    return {
      classPositions: [],
      moduleLayouts: [],
    }
  }

  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: "TB",
    nodesep: 60,
    ranksep: 80,
  })

  for (const cls of classes) {
    g.setNode(cls.id, { width: CLASS_NODE_WIDTH, height: CLASS_NODE_HEIGHT })
  }

  // Add directed edges for class hierarchy
  for (const cls of classes) {
    if (cls.parentClassId && cls.parentClassId !== cls.id) {
      g.setEdge(cls.parentClassId, cls.id)
    }
  }

  // Add directed edges for relations
  for (const rel of relations) {
    if (rel.domainClassId !== rel.rangeClassId) {
      g.setEdge(rel.domainClassId, rel.rangeClassId)
    }
  }

  dagre.layout(g)

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  const classPositions = classes.map((cls) => {
    const pos = g.node(cls.id) ?? { x: 0, y: 0 }
    const x = Math.round(pos.x - CLASS_NODE_WIDTH / 2)
    const y = Math.round(pos.y - CLASS_NODE_HEIGHT / 2)

    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x + CLASS_NODE_WIDTH > maxX) maxX = x + CLASS_NODE_WIDTH
    if (y + CLASS_NODE_HEIGHT > maxY) maxY = y + CLASS_NODE_HEIGHT

    return {
      classId: cls.id,
      moduleId,
      module: moduleName,
      x,
      y,
    }
  })

  const moduleLayouts = [
    {
      moduleId,
      module: moduleName,
      x: minX - PADDING,
      y: minY - PADDING,
      width: Math.max(300, maxX - minX + PADDING * 2),
      height: Math.max(160, maxY - minY + PADDING * 2),
    },
  ]

  return {
    classPositions,
    moduleLayouts,
  }
}
