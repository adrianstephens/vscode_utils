class Tree {
	root;

	constructor(root, notify) {
		this.root = root;

		root.querySelectorAll('.caret').forEach(caret => {
			caret.addEventListener('click', event => {
				if (event.target === caret) {
					caret.classList.toggle('caret-down');
					notify(caret, caret.classList.contains('caret-down'));
					event.stopPropagation();
				}
			});
		});
	}

	open(element) {
		element?.classList.add('caret-down');
	}
	close(element) {
		element?.classList.remove('caret-down');
	}

	close_all() {
		this.root.querySelectorAll('.caret-down').forEach(e => e.classList.remove('caret-down'));
	}
	
	all_open() {
		return Array.from(this.root.querySelectorAll('.caret-down'), element => generateSelector(element));
	}
	
	reveal(element) {
		if (element) {
			for (let parent = element.parentNode; parent; parent = parent.parentNode) {
				if (parent.classList?.contains('caret'))
					parent.classList.add('caret-down');
			}
			element.scrollIntoView({behavior: 'smooth', block: 'center'});
		}
	}
	
	lastStuck() {
		return lastStuck(this.root);
	}	
}

function lastStuck(tree) {
	const	x = tree.clientWidth - 20;
	let		y = 5;

	let last_stuck;
	for(;;) {
		const e = document.elementFromPoint(x, y);
		if (!e || getComputedStyle(e).getPropertyValue('position') != 'sticky')
			break;

		const bottom = e.getBoundingClientRect().bottom;
		if (e.nextElementSibling.getBoundingClientRect().top >= bottom)
			break;

		last_stuck = e;
		y = bottom + 5;
	}

	return last_stuck;
}

let prev_stuck;
function updateStuck() {
	const last_stuck = lastStuck(document.querySelector('.tree'));
	if (last_stuck !== prev_stuck) {
		if (prev_stuck)
			prev_stuck.classList.remove('stuck');

		if (last_stuck)
			last_stuck.classList.add('stuck');

		prev_stuck = last_stuck;
	}
}
