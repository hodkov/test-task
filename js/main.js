var photosUrlPrefix = "https://api.flickr.com/services/rest/?method=flickr.photos.search&api_key=1f23128e0bf03a4ad767388c180b846a&tags=cat&format=json&nojsoncallback=1";

function DataProvider() {
    this.currentPage = 0;
}

DataProvider.prototype.size = function () {
    return this.elements.length;
}

DataProvider.prototype.toUrl = function (jsonItem) {
    return "https://farm" + jsonItem.farm + ".staticflickr.com/" + jsonItem.server + "/" + jsonItem.id + "_" + jsonItem.secret + ".jpg";
}

DataProvider.prototype.getNextChunk = function (perPage) {
    if (perPage) {
        this.currentPage++;
    } else {
        perPage = 50;
    }
    var url = photosUrlPrefix + "&per_page=" + perPage + "&page=" + this.currentPage;
    return getJson(url).then((result) => {
        // TODO: Добавить обработку ошибок
        var photos = result.photos.photo;
        return photos.map((item) => this.toUrl(item));
    });
}

function UIElement(type) {
    if (!document) {
        throw new Error("document not set!");
    }
    this.htmlElement = document.createElement(type);
    this.children = [];
}

UIElement.prototype.addChild = function (child) {
    this.children.push(child);
    this.htmlElement.appendChild(child.htmlElement);
}

function Cell(imageUrl) {
    UIElement.call(this, "div");
    this.htmlElement.classList.add("content_table_cell");
    this.photo = new Photo(imageUrl);
    this.addChild(this.photo);
}

Cell.prototype = Object.create(UIElement.prototype);

Cell.prototype.focusIn = function () {
    this.photo.htmlElement.classList.add("focused");
}
Cell.prototype.focusOut = function () {
    this.photo.htmlElement.classList.remove("focused");
}

function Row(imageUrlsList) {
    UIElement.call(this, "div");
    this.htmlElement.classList.add("content_table_row");
    for (var i = 0; i < imageUrlsList.length; i++) {
        this.addChild(new Cell(imageUrlsList[i]));
    }
}

Row.prototype = Object.create(UIElement.prototype);

Row.prototype.unLoad = function () {
    this.children.forEach((cell) => cell.photo.unLoad());
}

Row.prototype.load = function () {
    this.children.forEach((cell) => cell.photo.load());
}

function Photo(imageUrl) {
    UIElement.call(this, "img");
    this.imageUrl = imageUrl;
    this.loaded = true;
    if (this.imageUrl) {
        this.htmlElement.setAttribute("src",  this.imageUrl);
    }
}

Photo.prototype = Object.create(UIElement.prototype);

Photo.prototype.unLoad = function () {
    if (!this.loaded) {
        return;
    }
    //TODO: можно gif 1x1
    this.htmlElement.setAttribute("src",  "");
    this.loaded = false;
}

Photo.prototype.load = function () {
    if (this.loaded) {
        return;
    }

    this.htmlElement.setAttribute("src", this.imageUrl);
    this.loaded = true;
}

function Table(columnsTotal) {
    UIElement.call(this, "div");
    this.columnsTotal = columnsTotal;
    this.htmlElement.classList.add("content_table");
    this.currentOnFocus = { columnIndex: 0, rowIndex: 0 };
}

Table.prototype = Object.create(UIElement.prototype);

Table.prototype.setFocusOn = function (columnIndex, rowIndex) {
    if (rowIndex < 0 || rowIndex >= this.children.length) {
        return;
    }

    if (columnIndex < 0 || columnIndex >= this.columnsTotal) {
        return;
    }

    var row = this.children[this.currentOnFocus.rowIndex];
    if (row && row.children[this.currentOnFocus.columnIndex]) {
        row.children[this.currentOnFocus.columnIndex].focusOut();
    }
    this.currentOnFocus = { columnIndex: columnIndex, rowIndex: rowIndex };
    var cell = this.children[rowIndex].children[columnIndex];
    cell.focusIn();
}

Table.prototype.moveLeft = function () {
    var nextFocusColumnIndex = this.currentOnFocus.columnIndex - 1;
    var nextFocusRowIndex = this.currentOnFocus.rowIndex;
    if (nextFocusColumnIndex < 0) {
        nextFocusColumnIndex = this.columnsTotal - 1;
        nextFocusRowIndex--;
    }
    this.setFocusOn(nextFocusColumnIndex, nextFocusRowIndex);
}

Table.prototype.moveRight = function () {
    var nextFocusColumnIndex = this.currentOnFocus.columnIndex + 1;
    var nextFocusRowIndex = this.currentOnFocus.rowIndex;
    if (nextFocusColumnIndex >= this.columnsTotal) {
        nextFocusColumnIndex = 0;
        nextFocusRowIndex++;
    }
    this.setFocusOn(nextFocusColumnIndex, nextFocusRowIndex);
}

Table.prototype.moveUp = function () {
    var nextFocusColumnIndex = this.currentOnFocus.columnIndex;
    var nextFocusRowIndex = this.currentOnFocus.rowIndex - 1;
    this.setFocusOn(nextFocusColumnIndex, nextFocusRowIndex);
}

Table.prototype.moveDown = function () {
    var nextFocusColumnIndex = this.currentOnFocus.columnIndex;
    var nextFocusRowIndex = this.currentOnFocus.rowIndex + 1;
    this.setFocusOn(nextFocusColumnIndex, nextFocusRowIndex);
}

function Scroller(verticalScrollStepSize, visibleRowsTotal) {
    this.verticalScrollStepSize = verticalScrollStepSize;
    this.visibleRowsTotal = visibleRowsTotal;
    UIElement.call(this, "div");
    this.htmlElement.classList.add("content");
    this.verticalScrollPosition = 0;
    this.table = new Table(5);
    this.addChild(this.table);
    this.isAnimationInProgress = false;
    this.curentIndexWithLoadedPhoto = 0;
    this.rowsInCache = 10;
    this.dataProvider = new DataProvider();
}

Scroller.prototype = Object.create(UIElement.prototype);

Scroller.prototype.init = function () {
    this.loadData()
        .then(() => this.table.setFocusOn(0, 0));
}

Scroller.prototype.loadData = function () {
    return this.dataProvider.getNextChunk()
        .then((photos) => {
            this.addPhotos(photos);
        });
}

Scroller.prototype.freeImagesInRange = function (topIndex, bottomIndex) {
    for (var i = topIndex; i < bottomIndex; i++) {
        this.table.children[i] && this.table.children[i].unLoad();
    }
}

Scroller.prototype.loadImagesInRange = function (topIndex, bottomIndex) {
    for (var i = topIndex; i < bottomIndex; i++) {
        this.table.children[i] && this.table.children[i].load();
    }
}

Scroller.prototype.addPhotos = function (photos) {
    // TODO: тут, конечно, можно завязаться на то, что число кратно пяти, но лучше предусмотреть разные кейсы
    var parts = chunk(photos, this.table.columnsTotal);
    for (var i = 0; i < parts.length; i++) {
        this.table.addChild(new Row(parts[i]));
    }

}

Scroller.prototype.moveLeft = function () {
    if (this.isAnimationInProgress) {
        return;
    }

    this.table.moveLeft();
    if (this.table.currentOnFocus.rowIndex < this.verticalScrollPosition) {
        this.scrollUp();
    }
}

Scroller.prototype.moveRight = function () {
    if (this.isAnimationInProgress) {
        return;
    }

    this.table.moveRight();
    if (this.table.currentOnFocus.rowIndex >= this.verticalScrollPosition + this.visibleRowsTotal) {
        this.scrollDown();
    }
}

Scroller.prototype.moveUp = function () {
    if (this.isAnimationInProgress) {
        return;
    }
    this.table.moveUp();
    if (this.table.currentOnFocus.rowIndex < this.verticalScrollPosition) {
        this.scrollUp();
    }
}

Scroller.prototype.moveDown = function () {
    if (this.isAnimationInProgress) {
        return;
    }
    this.table.moveDown();
    if (this.table.currentOnFocus.rowIndex >= this.verticalScrollPosition + this.visibleRowsTotal) {
        this.scrollDown();
    }
}

Scroller.prototype.animateTo = function (newVerticalScrollPosition) {
    if (this.isAnimationInProgress) {
        return;
    }
    this.isAnimationInProgress = true;
    var newScrollTop = Math.ceil(this.htmlElement.scrollTop + 
        (newVerticalScrollPosition - this.verticalScrollPosition) * this.verticalScrollStepSize);
    animate(this.htmlElement, 1000, { scrollTop: newScrollTop })
        .then(() => {
            this.verticalScrollPosition = newVerticalScrollPosition;
            if (this.verticalScrollPosition == this.table.children.length - 2) {
                this.loadData();
            }
            this.isAnimationInProgress = false;
        });
}

// чтобы увидеть контент наверху
Scroller.prototype.scrollUp = function () {
    if (this.verticalScrollPosition == 0) {
        return;
    }

    if (this.verticalScrollPosition - this.curentIndexWithLoadedPhoto <= 1 && this.curentIndexWithLoadedPhoto != 0) {
        this.freeImagesInRange(this.verticalScrollPosition + this.visibleRowsTotal + 1, this.curentIndexWithLoadedPhoto + this.rowsInCache);
        this.curentIndexWithLoadedPhoto = Math.max(0, this.verticalScrollPosition - this.rowsInCache);
        this.loadImagesInRange(this.curentIndexWithLoadedPhoto, this.verticalScrollPosition - this.visibleRowsTotal - 1);
    }

    this.animateTo(this.verticalScrollPosition - 1);
}

// чтобы увидеть контент внизу
Scroller.prototype.scrollDown = function () {
    if (this.verticalScrollPosition >= this.table.children.length - this.visibleRowsTotal) {
        return;
    }

    if (this.verticalScrollPosition - this.curentIndexWithLoadedPhoto >= this.rowsInCache - this.visibleRowsTotal - 1) {
        this.freeImagesInRange(this.curentIndexWithLoadedPhoto || 0, this.verticalScrollPosition - this.visibleRowsTotal - 1);
        this.curentIndexWithLoadedPhoto = this.verticalScrollPosition - 1;
        this.loadImagesInRange(this.verticalScrollPosition + this.visibleRowsTotal + 1, this.verticalScrollPosition + this.rowsInCache);
    }

    this.animateTo(this.verticalScrollPosition + 1);
}

function Main(root) {
    this.root = root;
    this.scroller = new Scroller(400, 1);
    this.root.appendChild(this.scroller.htmlElement);
    this.scroller.init();

    //TODO: в идеале сделать очередь, чтобы интерфейс был отзвычивей.
    document.onkeyup = (event) => {
        if (event.keyCode == 37) {
            this.scroller.moveLeft();
        } else if (event.keyCode == 39) {
            this.scroller.moveRight();
        } else if (event.keyCode == 38) {
            this.scroller.moveUp();
        } else if (event.keyCode == 40) {
            this.scroller.moveDown();
        }
    }

    var onWheel = (e) => {
        e = e || window.event;
        var delta = e.deltaY || e.detail || e.wheelDelta;
        if (delta > 0) {
            this.scroller.moveDown();
        } else {
            this.scroller.moveUp();
        }
    }

    if ('onwheel' in document) {
        document.addEventListener("wheel", onWheel);
    } else if ('onmousewheel' in document) {
        document.addEventListener("mousewheel", onWheel);
    } else {
        document.addEventListener("MozMousePixelScroll", onWheel);
    }
}
