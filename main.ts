import { ItemView, Plugin, TAbstractFile, TFile, WorkspaceLeaf, setIcon } from 'obsidian';

const FILE_VIEW: string = "file-view"
const CANVAS_VIEW: string = "canvas-view"
const ALL_VIEW: string = "all-view"

export default class CanvasLinksPlugin extends Plugin {

    onload(): void {
        // console.log('load plugin') // enable plugin

        this.registerView(FILE_VIEW, (leaf) => new FileView(leaf));
        this.registerView(CANVAS_VIEW, (leaf) => new CanvasView(leaf));

        this.addCommand({
            id: FILE_VIEW,
            name: 'Show "outgoing links" of canvas (which files the active canvas contains)',
            callback: () => {
                this.onloadFileView();
            }
        });

        this.addCommand({
            id: CANVAS_VIEW,
            name: 'Show "backlinks" of canvas (which canvases the active file embedded)',
            callback: () => {
                this.onloadCanvasView();
            }
        });

        this.addCommand({
            id: ALL_VIEW,
            name: 'Show "outgoing links" and "backlinks" of canvas',
            callback: () => {
                this.onloadFileView();
                this.onloadCanvasView();
            }
        });
    }

    async onloadFileView(): Promise<void> {
        if (this.app.workspace.getLeavesOfType(FILE_VIEW).length == 0) {
            await this.app.workspace.getRightLeaf(false).setViewState({
                type: FILE_VIEW,
                active: true,
            }); // view#onOpen()
        }
    }

    async onloadCanvasView(): Promise<void> {
        if (this.app.workspace.getLeavesOfType(CANVAS_VIEW).length == 0) {
            await this.app.workspace.getRightLeaf(false).setViewState({
                type: CANVAS_VIEW,
                active: true,
            }); // view#onOpen()
        }
    }

    onunload(): void {
        // console.log('unload plugin'); // disable plugin
    }
}

class FileView extends ItemView {

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return FILE_VIEW;
    }

    getDisplayText(): string {
        return "Files View";
    }

    async onOpen(): Promise<void> {
        this.icon = 'chevron-right-square'

        this.getFiles().then((notes) => {
            renderView(notes, 'Files the canvas contain', this.containerEl);
        });

        this.registerEvent(this.app.workspace.on('file-open', () => {
            this.getFiles().then((notes) => {
                renderView(notes, 'Files the canvas contain', this.containerEl);
            });
        }));
    }

    async getFiles(): Promise<TAbstractFile[]> {
        const activeCanvas: TFile | null = this.app.workspace.getActiveFile();
        if (activeCanvas == null || 'canvas' != activeCanvas.extension) {
            return [];
        }

        let canvasContent = '';
        await this.app.vault.cachedRead(activeCanvas).then((content: string) => {
            canvasContent = content;
        });

        const nodes: node[] = JSON.parse(canvasContent).nodes;
        if (nodes == null) {
            return [];
        }
        const filePaths: string[] = [];
        for (const node of nodes) {
            if ('file' == node.type) {
                filePaths.push(node.file);
            }
        }

        // const files: TFile[] = [];
        // const all: TFile[] = this.app.vault.getFiles();
        // for (const file of all) {
        //     if (filePaths.contains(file.path)) {
        //         files.push(file);
        //     }
        // }
        const files: TAbstractFile[] = [];
        for (const filePath of filePaths) {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file != null) {
                files.push(file);
            }
        }

        return files;
    }

    async onClose(): Promise<void> {
        // console.log('close view');
    }
}

class CanvasView extends ItemView {

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return CANVAS_VIEW;
    }

    getDisplayText(): string {
        return "Canvas View";
    }

    async onOpen(): Promise<void> {
        // console.log('open view');

        this.icon = 'chevron-left-square'

        this.getCanvas().then((canvas) => {
            renderView(canvas, 'Canvas the file embedded', this.containerEl);
        });

        this.registerEvent(this.app.workspace.on('file-open', () => {
            this.getCanvas().then((canvas) => {
                renderView(canvas, 'Canvas the file embedded', this.containerEl);
            });
        }));
    }

    async getCanvas(): Promise<TFile[]> {
        const activeFile: TFile | null = this.app.workspace.getActiveFile();
        if (activeFile == null) {
            return [];
        }

        const canvas: TFile[] = [];
        const all: TFile[] = this.app.vault.getFiles();
        for (const file of all) {
            if ('canvas' == file.extension) {
                canvas.push(file);
            }
        }

        const canvasContent: Map<TFile, string> = new Map<TFile, string>();
        for (const file of canvas) {
            await this.app.vault.cachedRead(file).then((content: string) => {
                canvasContent.set(file, content);
            });
        }

        const canvasEmebeded: TFile[] = [];
        for (const [file, content] of canvasContent) {
            const nodes: node[] = JSON.parse(content).nodes;
            if (nodes == null) {
                continue;
            }
            for (const node of nodes) {
                if ('file' == node.type && activeFile.path == node.file) {
                    canvasEmebeded.push(file);
                }
            }
        }

        return canvasEmebeded;
    }

    async onClose(): Promise<void> {
        // console.log('close view');
    }
}

function renderView(files: TAbstractFile[], text: string, container: Element): void {
    container.empty();

    const pane: HTMLDivElement = container.createDiv({
        cls: 'outgoing-link-pane node-insert-event',
        attr: { 'style': 'position: relative;' },
    });

    const header: HTMLDivElement = pane.createDiv({
        cls: 'tree-item-self is-clickable',
        attr: {
            'aria-label': 'Click to collapse',
            'aria-label-position': 'right'
        }
    });
    header.createSpan({ cls: 'tree-item-icon collapse-icon' });
    header.createDiv({
        cls: 'tree-item-inner',
        text: text
    });
    header.createDiv({ cls: 'tree-item-flair-outer' }, (el) => {
        el.createSpan({
            cls: 'tree-item-flair',
            text: files.length.toString()
        })
    });

    const content: HTMLDivElement = pane.createDiv({ cls: 'search-result-container' });
    content.createDiv({
        attr: {
            'style': 'width: 1px; height: 0.1px; margin-bottom: 0px;'
        }
    });
    for (const file of files) {
        content.createDiv({
            cls: 'tree-item-self is-clickable outgoing-link-item',
            attr: { 'draggable': true }
        }, (el) => {
            el.createSpan({ cls: 'tree-item-icon' }, (el) => {
                setIcon(el, 'link');
            });
            el.createDiv({
                cls: 'tree-item-inner',
                text: file.name.substring(0, file.name.lastIndexOf("."))
            }).addEventListener('click', () => {
                this.app.workspace.openLinkText('', file.path);
            });
        });
    }
}

type node = {
    type: string
    file: string
}