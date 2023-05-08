import { ItemView, Plugin, TFile, WorkspaceLeaf, setIcon } from 'obsidian';

const OUTGOING_LINK_VIEW_TYPE: string = "outgoing-link-canvas-view"
const BACKLINK_VIEW_TYPE: string = "backlink-canvas-view"

export default class CanvasViewPlugin extends Plugin {

    onload(): void {
        // console.log('load plugin') // enable plugin

        this.registerView(OUTGOING_LINK_VIEW_TYPE, (leaf) => new OutgoingLinkView(leaf));
        this.registerView(BACKLINK_VIEW_TYPE, (leaf) => new BacklinkView(leaf));

        this.addCommand({
            id: 'show-canvas-view',
            name: 'Show canvas view',
            callback: () => {
                this.onloadOutgoingLinkView();
                this.onloadBacklinkView();
            }
        });
    }

    async onloadOutgoingLinkView(): Promise<void> {
        this.app.workspace.detachLeavesOfType(OUTGOING_LINK_VIEW_TYPE);

        await this.app.workspace.getRightLeaf(false).setViewState({
            type: OUTGOING_LINK_VIEW_TYPE,
            active: true,
        }); // view#onOpen()
    }

    async onloadBacklinkView(): Promise<void> {
        this.app.workspace.detachLeavesOfType(BACKLINK_VIEW_TYPE);

        await this.app.workspace.getRightLeaf(false).setViewState({
            type: BACKLINK_VIEW_TYPE,
            active: true,
        }); // view#onOpen()
    }

    onunload(): void {
        // console.log('unload plugin'); // disable plugin
    }
}

class OutgoingLinkView extends ItemView {

    getViewType(): string {
        return OUTGOING_LINK_VIEW_TYPE;
    }

    getDisplayText(): string {
        return "Outgoing Link Canvas";
    }

    async onOpen(): Promise<void> {
        this.icon = 'chevron-right-square'

        this.getNotes().then((notes) => {
            renderFiles(notes, 'Notes', this.containerEl);
        });

        this.registerEvent(this.app.workspace.on('file-open', () => {
            this.getNotes().then((notes) => {
                renderFiles(notes, 'Notes', this.containerEl);
            });
        }));
    }

    async getNotes(): Promise<TFile[]> {
        const activeFile: TFile | null = this.app.workspace.getActiveFile();
        if (activeFile == null || 'canvas' != activeFile.extension) {
            return [];
        }

        let canvasContent = '';
        await this.app.vault.read(activeFile).then((content: string) => {
            canvasContent = content;
        });

        const nodes: node[] = JSON.parse(canvasContent).nodes;
        if (nodes == null) {
            return [];
        }
        const notePaths: string[] = [];
        for (const node of nodes) {
            if ('file' == node.type) {
                notePaths.push(node.file);
            }
        }

        const notes: TFile[] = [];
        const files: TFile[] = this.app.vault.getFiles();
        for (const file of files) {
            if (notePaths.contains(file.path)) {
                notes.push(file);
            }
        }

        return notes;
    }

    async onClose(): Promise<void> {
        // console.log('close view');
    }
}

class BacklinkView extends ItemView {

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return BACKLINK_VIEW_TYPE;
    }

    getDisplayText(): string {
        return "Backlink Canvas";
    }

    async onOpen(): Promise<void> {
        // console.log('open view');

        this.icon = 'chevron-left-square'

        this.getCanvas().then((canvas) => {
            renderFiles(canvas, 'Canvas', this.containerEl);
        });

        this.registerEvent(this.app.workspace.on('file-open', () => {
            this.getCanvas().then((canvas) => {
                renderFiles(canvas, 'Canvas',this.containerEl);
            });
        }));
    }

    async getCanvas(): Promise<TFile[]> {
        const activeFile: TFile | null = this.app.workspace.getActiveFile();
        if (activeFile == null) {
            return [];
        }

        const canvas: TFile[] = [];
        const files: TFile[] = this.app.vault.getFiles();
        for (const file of files) {
            if ('canvas' == file.extension) {
                canvas.push(file);
            }
        }

        const canvasContent: Map<TFile, string> = new Map<TFile, string>();
        for (const file of canvas) {
            await this.app.vault.read(file).then((content: string) => {
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

function renderFiles(files: TFile[], viewText: string,  container: Element): void {
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
        text: viewText
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
                text: file.basename
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