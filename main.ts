import { ItemView, Plugin, TFile, WorkspaceLeaf, setIcon } from "obsidian";
import { CanvasNodeData } from "obsidian/canvas";

const VIEW_TYPE: string = "canvas-links";

export default class CanvasLinksPlugin extends Plugin {
    async onload(): Promise<void> {
        this.registerView(VIEW_TYPE, (leaf) => new CanvasLinksView(leaf));

        const leafs: WorkspaceLeaf[] = this.app.workspace.getLeavesOfType(VIEW_TYPE);
        if (isEmpty(leafs)) {
            this.app.workspace.getRightLeaf(false)?.setViewState({
                type: VIEW_TYPE,
                active: true,
            });
        } else {
            this.app.workspace.revealLeaf(leafs[0]);
        }
    }
}

class CanvasLinksView extends ItemView {

    private selectedNodeId: string | null = null;
    private canvasNode: Map<string, string[]> = new Map<string, string[]>();

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return VIEW_TYPE;
    }

    getDisplayText(): string {
        return "Canvas Links";
    }

    async onOpen(): Promise<void> {
        this.icon = "align-center-horizontal"

        this.containerEl.empty();

        const element: HTMLDivElement = this.renderPane();

        const view: any = this.app.workspace.getLeaf().view;
        if (view.file != null) {
            this.render(element, view);
        }

        // add/delete text/node
        // move their position
        // cacheRead can get newest content immidiately when modify event trigger
        this.registerEvent(this.app.vault.on("modify", (file: TFile) => {
            if ("canvas" != file.extension) {
                return;
            }

            const view: any = this.app.workspace.getLeaf().view;

            const filePath: string = file.path;

            const previousNodeIds: string[] | undefined = this.canvasNode.get(filePath) ?? [];

            const canvas = view.canvas;
            let currentNodeIds: string[] = [];
            for (const [key, value] of canvas.nodes) {
                if (value.file != null) {
                    currentNodeIds.push(key);
                }
            }
            if (currentNodeIds.length != previousNodeIds.length) {
                this.canvasNode.set(filePath, currentNodeIds);
                this.render(element, view);
            }
        }));

        this.registerEvent(this.app.workspace.on("active-leaf-change", (leaf: WorkspaceLeaf) => {
            const afterChangeView: any = leaf.view;
            if (afterChangeView.file == null) {
                if ("empty" === afterChangeView.getViewType()) {
                    element.empty();
                }
            } else {
                if ("canvas" === afterChangeView.getViewType() && this.selectedNodeId != null) {
                    // jump from canvas-link need focus
                    const canvas = afterChangeView.canvas;
                    for (const [key, value] of canvas.nodes) {
                        if (key === this.selectedNodeId) {
                            focus(canvas, value);
                            this.selectedNodeId = null;
                            break;
                        }
                    }
                }
                this.render(element, afterChangeView);
            }

        }));
    }

    renderPane(): HTMLDivElement {
        return this.containerEl.createDiv({
            cls: "outgoing-link-pane node-insert-event",
            attr: { "style": "position: relative;" },
        });
    }

    render(body: HTMLDivElement, view: any) {
        body.empty();
        if ("canvas" === view.getViewType()) {
            this.renderFiles(body, view.file as TFile, view.canvas.nodes);
            this.renderCanvases(body, view.file as TFile);
        } else {
            this.renderCanvases(body, view.file as TFile);
        }
    }

    renderFiles(body: HTMLDivElement, currentFile: TFile, nodes: Map<string, CanvasNodeData>) {
        const header: HTMLDivElement = body.createDiv({
            cls: "tree-item-self is-clickable",
            attr: {
                "aria-label": "Click to collapse",
                "aria-label-position": "right"
            }
        });
        header.createSpan({ cls: "tree-item-icon collapse-icon" });
        header.createDiv({
            cls: "tree-item-inner",
            text: "FILE CONTAIN"
        });

        const files: TFile[] = this.getFiles(currentFile, nodes);
        header.createDiv({ cls: "tree-item-flair-outer" }, (el) => {
            el.createSpan({
                cls: "tree-item-flair",
                text: files.length.toString()
            })
        });

        if (isEmpty(files)) {
            return;
        }
        const content: HTMLDivElement = body.createDiv({ cls: "search-result-container" });
        content.createDiv({
            attr: {
                "style": "width: 1px; height: 0.1px; margin-bottom: 0px;"
            }
        });
        for (const file of files) {
            content.createDiv({
                cls: "tree-item-self is-clickable outgoing-link-item",
                attr: { "draggable": true }
            }, (el) => {
                el.createSpan({ cls: "tree-item-icon" }, (el) => {
                    if ("md" === file.extension) {
                        setIcon(el, "file-text");
                    } else {
                        setIcon(el, "file-image");
                    }
                });
                el.createDiv({
                    cls: "tree-item-inner",
                    text: file.name.substring(0, file.name.lastIndexOf(".")) // don't show path, like link view
                })
            }).addEventListener("click", () => {
                this.app.workspace.openLinkText("", file.path);
            });;
        }
    }

    async renderCanvases(body: HTMLDivElement, currentFile: TFile) {
        const header: HTMLDivElement = body.createDiv({
            cls: "tree-item-self is-clickable",
            attr: {
                "aria-label": "Click to collapse",
                "aria-label-position": "right"
            }
        });
        header.createSpan({ cls: "tree-item-icon collapse-icon" });
        header.createDiv({
            cls: "tree-item-inner",
            text: "CANVAS CONTAINED"
        });

        const canvases: TFile[] = await this.getCanvas(currentFile);
        header.createDiv({ cls: "tree-item-flair-outer" }, (el) => {
            el.createSpan({
                cls: "tree-item-flair",
                text: canvases.length.toString()
            })
        });

        if (isEmpty(canvases)) {
            return;
        }
        const content: HTMLDivElement = body.createDiv({ cls: "search-result-container" });
        content.createDiv({
            attr: {
                "style": "width: 1px; height: 0.1px; margin-bottom: 0px;"
            }
        });
        for (const canvas of canvases) {
            content.createDiv({
                cls: "tree-item-self is-clickable outgoing-link-item",
                attr: { "draggable": true }
            }, (el) => {
                el.createSpan({ cls: "tree-item-icon" }, (el) => {
                    setIcon(el, "layout-dashboard");
                });
                el.createDiv({
                    cls: "tree-item-inner",
                    text: canvas.name.substring(0, canvas.name.lastIndexOf(".")) // don't show path, like link view
                })
            }).addEventListener("click", () => {
                this.app.workspace.openLinkText("", canvas.path);
                this.selectedNodeId = (canvas as Canvas).selectedNodeId;
            });;
        }
    }

    async getCanvas(currentFile: TFile): Promise<TFile[]> {
        const canvases: Canvas[] = [];

        const files: TFile[] = this.app.vault.getFiles();
        for (const file of files) {
            if ("canvas" != file.extension) {
                continue;
            }

            const content: string = await this.app.vault.cachedRead(file);
            if (isEmpty(content)) {
                continue;
            }

            const nodes: CanvasNodeData[] = JSON.parse(content).nodes;
            if (nodes == null) {
                continue;
            }

            for (const node of nodes) {
                if ("file" === node.type && currentFile.path === node.file) {
                    const canvas = file as Canvas;
                    canvas.selectedNodeId = node.id;
                    canvases.push(canvas);
                    break; // only push canvas only once
                }
            }
        }

        canvases.sort((a, b) =>
            asc(a.basename.toLowerCase(), b.basename.toLowerCase()));
        return canvases;
    }

    getFiles(currentFile: TFile, nodes: Map<string, CanvasNodeData>): TFile[] {
        const files: TFile[] = [];
        let nodeIds: string[] = [];
        for (const [key, value] of nodes) {
            if (value.file != null) {
                nodeIds.push(key);
                files.push(value.file);
            }
        }
        this.canvasNode.set(currentFile.path, nodeIds);

        files.sort((a, b) =>
            asc(a.basename.toLowerCase(), b.basename.toLowerCase()));
        return files;
    }
}

interface Canvas extends TFile {
    selectedNodeId: string
}

function focus(canvas: any, node: any) {
    canvas.select(node);
    canvas.zoomToSelection()
}

function isEmpty<T>(value: T): boolean {
    if (typeof value === "string") {
        if (value && value.length > 0) {
            return false;
        } else {
            return true;
        }
    } else if (value instanceof Array) {
        if (value && value.length > 0) {
            return false;
        } else {
            return true;
        }
    }
    return true;
}

function asc<T>(a: T, b: T): number {
    if (a < b) {
        return -1;
    }
    if (a > b) {
        return 1;
    }
    return 0;
}