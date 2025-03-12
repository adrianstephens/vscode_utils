const vscode		= acquireVsCodeApi();

//fix up icons in attributes
document.querySelectorAll('[icon]').forEach(element => {
	const value = element.getAttribute('icon');
	if (value.includes('/')) {
		element.removeAttribute('icon');
		element.classList.add('icon');
		element.style.setProperty('--icon', `url(${value})`);
	}
	const col = element.getAttribute('color');
	if (col) {
		element.removeAttribute('color');
		element.style.setProperty('--icon-color', col);
	}
});


document.querySelectorAll('.select').forEach(item => {
	item.addEventListener('click', event => {
		if (event.target === item) {
			vscode.postMessage({
				command: 'select',
				selector: generateSelector(item),
				text: item.textContent,
				...item.dataset
			});
			event.stopPropagation();
		}
	});
});

function createElement(tag, options) {
	const e = document.createElement(tag);
	if (options) {
		for (const [k,v] of Object.entries(options))
			e[k] = v;
	}
	return e;
}

function getFirstText(element) {
	for (const node of element.childNodes) {
		if (node.nodeType === Node.TEXT_NODE) {
			const text = node.textContent.trim();
			if (text)
				return text;
		}
	}
}

class Pool {
	pool	= [];
	constructor(make) { this.make = make; }

	get() {
		if (this.pool.length === 0)
			this.pool.push(this.make());

		return this.pool.length === 1
			? this.pool[0].cloneNode(true)
			: this.pool.pop();
	}
	
	discard(item) {
		this.pool.push(item);
	}
	discardElement(item) {
		this.discard(item);
		item.remove();
	}

}

//-------------------------------------
// splitter
//-------------------------------------

class Splitter {
	splitter;

	constructor(splitter, notify) {
		this.splitter = splitter;

		splitter.addEventListener('pointerdown', e => {
			e.preventDefault();
			splitter.setPointerCapture(e.pointerId);
	
			const left		= splitter.previousSibling;
			const style		= getComputedStyle(left);
			let split		= left.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
			const offset	= split - e.clientX;
	
			const min		= parseFloat(style.minWidth);
			const max		= Math.min(parseFloat(style.maxWidth), splitter.parentNode.clientWidth - 300);
	
			left.style.width	= `${split}px`;
			left.style.flex		= 'none';
	
			function resizePanels(e) {
				split = Math.min(Math.max(e.clientX + offset, min), max);
				left.style.width = `${split}px`;
			}
			
			function stopResizing(e) {
				notify(split);
				//state.split = split;
				//vscode.setState(state);
	
				splitter.releasePointerCapture(e.pointerId);
				document.removeEventListener('pointermove', resizePanels);
				document.removeEventListener('pointerup', stopResizing);
			}
			
			document.addEventListener('pointermove', resizePanels);
			document.addEventListener('pointerup', stopResizing);
		});
	}

	set(x) {
		const left = this.splitter.previousSibling;
		left.style.width	= `${x}px`;
		left.style.flex	 	= 'none';
	}
	
}

//-------------------------------------
// Scrollbar
//-------------------------------------

/*
interface Container {
	clientOffset:	number;	//pixel offset for top of track
	clientPixels:	number;	//pixel size of track
	clientSize:		number;	//unit size of visible region
	scrollOffset:	number;	//scroll position in units
	scrollSize:		number;	//size of overall region in units
	setScroll(x: 	number);//set scroll position in units
}
*/

function VScrollContainer(container, offset = 0) {
	return {
		clientOffset: 		Math.max(container.clientTop, 0) + offset,
		get clientPixels() 	{ return container.clientHeight - offset; },
		get clientSize()	{ return container.clientHeight - offset; },
		get scrollOffset()	{ return container.scrollTop; },
		get scrollSize() 	{ return container.scrollHeight; },
		setScroll(x)		{ container.scrollTop = x; },
	};
}

function HScrollContainer(container, offset = 0) {
	return {
		clientOffset: 		Math.max(container.clientLeft, 0) + offset,
		get clientPixels() 	{ return container.clientWidth - offset; },
		get clientSize() 	{ return container.clientWidth - offset; },
		get scrollOffset() 	{ return container.scrollLeft; },
		get scrollSize() 	{ return container.scrollWidth; },
		setScroll(x)		{ container.scrollLeft = x; },
	};
}

class ScrollBar {
	thumbSize;

	constructor(parent, container, horizontal) {
		if (container instanceof HTMLElement) {
			container = horizontal ? HScrollContainer(container) : VScrollContainer(container);
		}
		const thumb 	= createElement('div', {className: horizontal ? 'hscrollbar' : 'vscrollbar'});
		parent.appendChild(thumb);

		this.thumb		= thumb;
		this.container	= container;
		this.horizontal = horizontal;
		this.update();

		thumb.addEventListener("lostpointercapture", e => {
			if (thumb.onMouseUp)
				thumb.onMouseUp(e);
		});

		thumb.addEventListener('pointerdown', event => {
			console.log('down');
			const pointerOffset 	= horizontal ? thumb.offsetLeft - event.clientX : thumb.offsetTop - event.clientY;
			thumb.classList.add('active');

			const onPointerMove = event => {
				this.setThumbPixel(pointerOffset + (horizontal ? event.clientX : event.clientY));
			};
	
			const onPointerUp = () => {
				console.log('up');
				thumb.classList.remove('active');
				window.removeEventListener('pointermove',	onPointerMove);
				window.removeEventListener('pointerup',		onPointerUp);
			};

			if (thumb.setPointerCapture)
				thumb.setPointerCapture(event.pointerId);

			window.addEventListener('pointermove',	onPointerMove);
			window.addEventListener('pointerup', 	onPointerUp);
		});
	}

	update() {
		this.setThumb(this.container.scrollOffset);
	}

	setScroll(scroll) {
		this.container.setScroll(scroll);
		this.setThumb(scroll);
	}

	setThumbSize(size) {
		if (size != this.thumbSize) {
			this.thumbSize = size;
			if (this.horizontal)
				this.thumb.style.width 	= `${size}px`;
			else
				this.thumb.style.height = `${size}px`;
		}
	}
	
	setThumb(scroll) {
		const clientPixels	= this.container.clientPixels;
		const clientSize	= this.container.clientSize;
		const scrollSize	= this.container.scrollSize;
		const clientOffset	= this.container.clientOffset;
		let thumbPos, thumbSize;
	
		if (clientSize >= scrollSize) {
			this.thumb.classList.add('invisible');
			thumbSize	= scrollSize;
			thumbPos	= clientOffset;
		} else {
			this.thumb.classList.remove('invisible');
			thumbSize	= Math.max(clientPixels * clientSize / scrollSize, 20);
			thumbPos	= clientOffset + scroll * (clientPixels - thumbSize) / (scrollSize - clientSize);
		}

		this.setThumbSize(thumbSize);

		if (this.horizontal)
			this.thumb.style.left 	= `${thumbPos}px`;
		else
			this.thumb.style.top 	= `${thumbPos}px`;
	}
	
	setThumbPixel(pos) {
		const clientPixels	= this.container.clientPixels;
		const clientSize	= this.container.clientSize;
		const scrollSize	= this.container.scrollSize;
		const clientOffset	= this.container.clientOffset;
		const thumbPos		= Math.min(Math.max(pos, clientOffset), clientOffset + clientPixels - this.thumbSize);
		const scroll		= (thumbPos - clientOffset) * (scrollSize - clientSize) / (clientPixels - this.thumbSize);

		this.container.setScroll(scroll);
		if (this.horizontal) {
			this.thumb.style.left		= `${thumbPos}px`;
		} else {
			this.thumb.style.top 		= `${thumbPos}px`;
		}
	}
}

let resizeTimeout;

window.addEventListener('resize', () => {
	document.documentElement.classList.add('resizing');
	clearTimeout(resizeTimeout);
	resizeTimeout = setTimeout(() => document.documentElement.classList.remove('resizing'), 500);
});


//-------------------------------------
// template
//-------------------------------------

function replace(text, re, process) {
	let i = 0;
	let result = '';
	for (let m; (m = re.exec(text)); i = re.lastIndex)
		result += text.substring(i, m.index) + process(m);
	return result + text.substring(i);
}

function replace_in_element(e, re, process) {
	if (e.id)
		e.id = replace(e.id, re, process);
	if (e.attributes.name)
		e.attributes.name.value = replace(e.attributes.name.value, re, process);
	const childNodes = e.childNodes;
	for (let i = 0; i < childNodes.length; i++) {
		const node = childNodes[i];
		if (node.nodeType === window.Node.TEXT_NODE)
			node.textContent = replace(node.textContent, re, process);
		else if (node.nodeType === window.Node.ELEMENT_NODE)
			replace_in_element(node, re, process);
	}
}

function template(template, parent, values) {
	const newnodes = values.map(i => {
		const child = template.cloneNode(true);
		child.hidden = false;
		replace_in_element(child, /\$\((.*)\)/g, m => i[m[1]]);
		return child;
	});

//	const parent = after.parentNode;
//	const before = after.nextSibling;
	const before = null;
	for (const i of newnodes)
		parent.insertBefore(i, before);
}

function generateSelector(e) {
	const path = [];
	while (e && e.nodeType === Node.ELEMENT_NODE) {
		let index = 1;
		for (let s = e; (s = s.previousElementSibling);) {
			if (s.tagName === e.tagName)
				index++;
		}
		//const selector = e.tagName.toLowerCase() + (index > 1 ? `:nth-of-type(${index})` : '');
		const selector = `${e.tagName.toLowerCase()}:nth-of-type(${index})`;
		path.unshift(selector);
		e = e.parentNode;
	}
	return path.join(' > ');
}

