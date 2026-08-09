// 中国象棋核心逻辑
class ChineseChess {
    constructor() {
        this.board = this.initBoard();
        this.currentPlayer = 'red'; // red 或 black
        this.selectedPiece = null;
        this.moveHistory = [];
        this.round = 1;
        this.gameOver = false;
        this.winner = null;

        // 棋子定义
        this.pieces = {
            'r_king': { name: '帅', color: 'red', type: 'king' },
            'r_advisor': { name: '仕', color: 'red', type: 'advisor' },
            'r_elephant': { name: '相', color: 'red', type: 'elephant' },
            'r_horse': { name: '马', color: 'red', type: 'horse' },
            'r_rook': { name: '车', color: 'red', type: 'rook' },
            'r_cannon': { name: '炮', color: 'red', type: 'cannon' },
            'r_pawn': { name: '兵', color: 'red', type: 'pawn' },
            'b_king': { name: '将', color: 'black', type: 'king' },
            'b_advisor': { name: '士', color: 'black', type: 'advisor' },
            'b_elephant': { name: '象', color: 'black', type: 'elephant' },
            'b_horse': { name: '马', color: 'black', type: 'horse' },
            'b_rook': { name: '车', color: 'black', type: 'rook' },
            'b_cannon': { name: '炮', color: 'black', type: 'cannon' },
            'b_pawn': { name: '卒', color: 'black', type: 'pawn' }
        };
    }

    initBoard() {
        // 10行9列的棋盘，null表示空位
        const board = Array(10).fill(null).map(() => Array(9).fill(null));

        // 黑方（上方，行0-4）
        board[0][0] = 'b_rook'; board[0][8] = 'b_rook';
        board[0][1] = 'b_horse'; board[0][7] = 'b_horse';
        board[0][2] = 'b_elephant'; board[0][6] = 'b_elephant';
        board[0][3] = 'b_advisor'; board[0][5] = 'b_advisor';
        board[0][4] = 'b_king';
        board[2][1] = 'b_cannon'; board[2][7] = 'b_cannon';
        board[3][0] = 'b_pawn'; board[3][2] = 'b_pawn';
        board[3][4] = 'b_pawn'; board[3][6] = 'b_pawn'; board[3][8] = 'b_pawn';

        // 红方（下方，行5-9）
        board[9][0] = 'r_rook'; board[9][8] = 'r_rook';
        board[9][1] = 'r_horse'; board[9][7] = 'r_horse';
        board[9][2] = 'r_elephant'; board[9][6] = 'r_elephant';
        board[9][3] = 'r_advisor'; board[9][5] = 'r_advisor';
        board[9][4] = 'r_king';
        board[7][1] = 'r_cannon'; board[7][7] = 'r_cannon';
        board[6][0] = 'r_pawn'; board[6][2] = 'r_pawn';
        board[6][4] = 'r_pawn'; board[6][6] = 'r_pawn'; board[6][8] = 'r_pawn';

        return board;
    }

    // 重置游戏状态
    resetState() {
        this.gameOver = false;
        this.winner = null;
    }

    getPiece(row, col) {
        if (row < 0 || row >= 10 || col < 0 || col >= 9) return null;
        const pieceId = this.board[row][col];
        return pieceId ? this.pieces[pieceId] : null;
    }

    selectPiece(row, col) {
        if (this.gameOver) {
            return { success: false, message: '游戏已结束，请开始新局' };
        }
        const piece = this.getPiece(row, col);
        if (!piece || piece.color !== this.currentPlayer) {
            return { success: false, message: '没有可走的棋子' };
        }
        this.selectedPiece = { row, col, piece };
        return { success: true, message: this.describePiece(row, col, piece) };
    }

    movePiece(toRow, toCol) {
        if (this.gameOver) {
            return { success: false, message: '游戏已结束，请开始新局' };
        }
        if (!this.selectedPiece) {
            return { success: false, message: '请先选择棋子' };
        }

        const fromRow = this.selectedPiece.row;
        const fromCol = this.selectedPiece.col;
        const piece = this.selectedPiece.piece;

        // 检查是否合法走法
        if (!this.isValidMove(fromRow, fromCol, toRow, toCol, piece)) {
            return { success: false, message: '不合法的走法' };
        }

        // 检查走棋后是否造成己方被将军（不允许送将）
        if (this.wouldBeInCheck(fromRow, fromCol, toRow, toCol, piece.color)) {
            return { success: false, message: '这样走会被将军，不允许' };
        }

        // 检查是否吃子
        const captured = this.getPiece(toRow, toCol);
        let message = this.describeMove(fromRow, fromCol, toRow, toCol, piece);

        // 执行移动
        this.board[toRow][toCol] = this.board[fromRow][fromCol];
        this.board[fromRow][fromCol] = null;

        // 记录历史
        this.moveHistory.push({
            from: { row: fromRow, col: fromCol },
            to: { row: toRow, col: toCol },
            piece: piece,
            captured: captured
        });

        // 切换玩家
        this.currentPlayer = this.currentPlayer === 'red' ? 'black' : 'red';
        if (this.currentPlayer === 'red') this.round++;

        // 清除选中状态
        this.selectedPiece = null;

        if (captured) {
            message += `，吃掉${captured.color === 'red' ? '红方' : '黑方'}${captured.name}`;
        }

        // ========== 关键修复：检查游戏结束 ==========
        // 1. 检查是否吃掉将/帅
        if (captured && captured.type === 'king') {
            this.gameOver = true;
            this.winner = piece.color;
            const winnerName = piece.color === 'red' ? '红方' : '黑方';
            message += `。${winnerName}获胜！`;
            return { success: true, message, gameOver: true, winner: piece.color };
        }

        // 2. 检查对方是否被将杀或困毙
        const opponent = this.currentPlayer;
        const opponentMoves = this.getAllMoves(opponent);
        if (opponentMoves.length === 0) {
            this.gameOver = true;
            // 如果对方被将军且无棋可走 = 将杀；否则 = 困毙
            const inCheck = this.isInCheck(opponent);
            this.winner = inCheck ? (opponent === 'red' ? 'black' : 'red') : (opponent === 'red' ? 'black' : 'red');
            const winnerName = this.winner === 'red' ? '红方' : '黑方';
            const loserName = opponent === 'red' ? '红方' : '黑方';
            if (inCheck) {
                message += `。${loserName}被将杀，${winnerName}获胜！`;
            } else {
                message += `。${loserName}无棋可走（困毙），${winnerName}获胜！`;
            }
            return { success: true, message, gameOver: true, winner: this.winner };
        }

        // 3. 检查将军
        if (this.isInCheck(opponent)) {
            message += '，将军！';
        }

        return { success: true, message };
    }

    // 检查某方走棋后是否会造成己方被将军
    wouldBeInCheck(fromRow, fromCol, toRow, toCol, color) {
        const capturedId = this.board[toRow][toCol];
        const pieceId = this.board[fromRow][fromCol];
        this.board[toRow][toCol] = pieceId;
        this.board[fromRow][fromCol] = null;

        const inCheck = this.isInCheck(color);

        // 恢复
        this.board[fromRow][fromCol] = pieceId;
        this.board[toRow][toCol] = capturedId;

        return inCheck;
    }

    isValidMove(fromRow, fromCol, toRow, toCol, piece) {
        // 基本的边界检查
        if (toRow < 0 || toRow >= 10 || toCol < 0 || toCol >= 9) return false;

        // 不能吃自己的棋子
        const target = this.getPiece(toRow, toCol);
        if (target && target.color === piece.color) return false;

        // 根据棋子类型检查走法
        switch (piece.type) {
            case 'king':
                return this.isValidKingMove(fromRow, fromCol, toRow, toCol, piece);
            case 'advisor':
                return this.isValidAdvisorMove(fromRow, fromCol, toRow, toCol, piece);
            case 'elephant':
                return this.isValidElephantMove(fromRow, fromCol, toRow, toCol, piece);
            case 'horse':
                return this.isValidHorseMove(fromRow, fromCol, toRow, toCol, piece);
            case 'rook':
                return this.isValidRookMove(fromRow, fromCol, toRow, toCol, piece);
            case 'cannon':
                return this.isValidCannonMove(fromRow, fromCol, toRow, toCol, piece);
            case 'pawn':
                return this.isValidPawnMove(fromRow, fromCol, toRow, toCol, piece);
        }
        return false;
    }

    isValidKingMove(fromRow, fromCol, toRow, toCol, piece) {
        const dr = Math.abs(toRow - fromRow);
        const dc = Math.abs(toCol - fromCol);

        // 九宫内一步直行
        if (dr + dc === 1) {
            if (piece.color === 'red') {
                return toRow >= 7 && toRow <= 9 && toCol >= 3 && toCol <= 5;
            } else {
                return toRow >= 0 && toRow <= 2 && toCol >= 3 && toCol <= 5;
            }
        }

        // ========== 飞将规则：两将对面 ==========
        // 将可以在同一列上直接吃掉对方的将（中间无子）
        if (fromCol === toCol && dc === 0) {
            const opponentKingName = piece.color === 'red' ? '将' : '帅';
            // 检查目标位置是否是对方将/帅
            const targetPiece = this.getPiece(toRow, toCol);
            if (targetPiece && targetPiece.name === opponentKingName) {
                // 检查中间是否有棋子
                const minRow = Math.min(fromRow, toRow);
                const maxRow = Math.max(fromRow, toRow);
                for (let r = minRow + 1; r < maxRow; r++) {
                    if (this.getPiece(r, fromCol)) return false;
                }
                return true; // 飞将合法
            }
        }

        return false;
    }

    isValidAdvisorMove(fromRow, fromCol, toRow, toCol, piece) {
        // 九宫内一步斜行
        const dr = Math.abs(toRow - fromRow);
        const dc = Math.abs(toCol - fromCol);
        if (dr !== 1 || dc !== 1) return false;

        if (piece.color === 'red') {
            return toRow >= 7 && toRow <= 9 && toCol >= 3 && toCol <= 5;
        } else {
            return toRow >= 0 && toRow <= 2 && toCol >= 3 && toCol <= 5;
        }
    }

    isValidElephantMove(fromRow, fromCol, toRow, toCol, piece) {
        // 走田字，不能过河
        const dr = Math.abs(toRow - fromRow);
        const dc = Math.abs(toCol - fromCol);
        if (dr !== 2 || dc !== 2) return false;

        // 检查象眼
        const eyeRow = (fromRow + toRow) / 2;
        const eyeCol = (fromCol + toCol) / 2;
        if (this.getPiece(eyeRow, eyeCol)) return false;

        // 检查是否过河
        if (piece.color === 'red') {
            return toRow >= 5;
        } else {
            return toRow <= 4;
        }
    }

    isValidHorseMove(fromRow, fromCol, toRow, toCol, piece) {
        // 走日字
        const dr = Math.abs(toRow - fromRow);
        const dc = Math.abs(toCol - fromCol);
        if (!((dr === 2 && dc === 1) || (dr === 1 && dc === 2))) return false;

        // 检查马腿
        if (dr === 2) {
            const legRow = fromRow + (toRow - fromRow) / 2;
            if (this.getPiece(legRow, fromCol)) return false;
        } else {
            const legCol = fromCol + (toCol - fromCol) / 2;
            if (this.getPiece(fromRow, legCol)) return false;
        }

        return true;
    }

    isValidRookMove(fromRow, fromCol, toRow, toCol, piece) {
        // 直线移动，不能越子
        if (fromRow !== toRow && fromCol !== toCol) return false;

        if (fromRow === toRow) {
            const step = toCol > fromCol ? 1 : -1;
            for (let c = fromCol + step; c !== toCol; c += step) {
                if (this.getPiece(fromRow, c)) return false;
            }
        } else {
            const step = toRow > fromRow ? 1 : -1;
            for (let r = fromRow + step; r !== toRow; r += step) {
                if (this.getPiece(r, fromCol)) return false;
            }
        }

        return true;
    }

    isValidCannonMove(fromRow, fromCol, toRow, toCol, piece) {
        // 移动同车，吃子需隔一子
        if (fromRow !== toRow && fromCol !== toCol) return false;

        let count = 0;
        if (fromRow === toRow) {
            const step = toCol > fromCol ? 1 : -1;
            for (let c = fromCol + step; c !== toCol; c += step) {
                if (this.getPiece(fromRow, c)) count++;
            }
        } else {
            const step = toRow > fromRow ? 1 : -1;
            for (let r = fromRow + step; r !== toRow; r += step) {
                if (this.getPiece(r, fromCol)) count++;
            }
        }

        const target = this.getPiece(toRow, toCol);
        if (target) {
            return count === 1; // 吃子必须隔一子
        } else {
            return count === 0; // 移动不能越子
        }
    }

    isValidPawnMove(fromRow, fromCol, toRow, toCol, piece) {
        const dr = toRow - fromRow;
        const dc = toCol - fromCol;

        if (piece.color === 'red') {
            // 红方向上走
            if (fromRow >= 5) {
                // 未过河，只能前进
                return dr === -1 && dc === 0;
            } else {
                // 已过河，可前进或左右
                return (dr === -1 && dc === 0) || (dr === 0 && Math.abs(dc) === 1);
            }
        } else {
            // 黑方向下走
            if (fromRow <= 4) {
                // 未过河，只能前进
                return dr === 1 && dc === 0;
            } else {
                // 已过河，可前进或左右
                return (dr === 1 && dc === 0) || (dr === 0 && Math.abs(dc) === 1);
            }
        }
    }

    undo() {
        if (this.moveHistory.length === 0) {
            return { success: false, message: '没有可悔的棋' };
        }

        const lastMove = this.moveHistory.pop();
        this.board[lastMove.from.row][lastMove.from.col] =
            this.board[lastMove.to.row][lastMove.to.col];
        this.board[lastMove.to.row][lastMove.to.col] =
            lastMove.captured ? this.getPieceId(lastMove.captured) : null;

        this.currentPlayer = this.currentPlayer === 'red' ? 'black' : 'red';
        if (this.currentPlayer === 'black') this.round--;

        // 悔棋时重置游戏结束状态
        this.gameOver = false;
        this.winner = null;

        return { success: true, message: '已悔棋' };
    }

    getPieceId(piece) {
        for (const [id, p] of Object.entries(this.pieces)) {
            if (p.name === piece.name && p.color === piece.color) return id;
        }
        return null;
    }

    describePiece(row, col, piece) {
        const colName = this.getColumnName(col, piece.color);
        const rowName = this.getRowName(row);
        return `${piece.color === 'red' ? '红方' : '黑方'}，${piece.name}，位于${colName}路第${rowName}线`;
    }

    describeMove(fromRow, fromCol, toRow, toCol, piece) {
        const fromColName = this.getColumnName(fromCol, piece.color);
        const toColName = this.getColumnName(toCol, piece.color);

        let action = '';
        if (fromRow === toRow) {
            action = '平';
        } else if ((piece.color === 'red' && toRow < fromRow) ||
                   (piece.color === 'black' && toRow > fromRow)) {
            action = '进';
        } else {
            action = '退';
        }

        const target = action === '平' ? toColName :
                       (piece.type === 'king' || piece.type === 'advisor' ||
                        piece.type === 'elephant' || piece.type === 'horse' ||
                        piece.type === 'pawn') ?
                       this.getRowName(Math.abs(toRow - fromRow)) : toColName;

        return `${piece.name}${fromColName}${action}${target}`;
    }

    getColumnName(col, color) {
        const redNames = ['九', '八', '七', '六', '五', '四', '三', '二', '一'];
        const blackNames = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
        return color === 'red' ? redNames[col] : blackNames[col];
    }

    getRowName(row) {
        return ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][row];
    }

    // ========== 修复：扫描全部棋盘，不再遗漏过河棋子 ==========
    describeBoard() {
        let desc = `${this.currentPlayer === 'red' ? '红方' : '黑方'}走棋。第${this.round}回合。\n`;

        // 红方所有棋子（扫描全部10行）
        desc += '红方：';
        let redPieces = [];
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const piece = this.getPiece(r, c);
                if (piece && piece.color === 'red') {
                    redPieces.push(`${piece.name}在${this.getColumnName(c, 'red')}路${this.getRowName(r)}线`);
                }
            }
        }
        desc += redPieces.length > 0 ? redPieces.join('，') + '。' : '无棋子。';

        // 黑方所有棋子（扫描全部10行）
        desc += '黑方：';
        let blackPieces = [];
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const piece = this.getPiece(r, c);
                if (piece && piece.color === 'black') {
                    blackPieces.push(`${piece.name}在${this.getColumnName(c, 'black')}路${this.getRowName(r)}线`);
                }
            }
        }
        desc += blackPieces.length > 0 ? blackPieces.join('，') + '。' : '无棋子。';

        return desc;
    }

    // ========== 功能2：语音指令解析 ==========
    parseVoiceCommand(text) {
        if (!text) return null;
        text = text.trim();

        const pieceNames = ['帅', '将', '仕', '士', '相', '象', '马', '车', '炮', '兵', '卒'];
        const redColChars = { '一':0, '二':1, '三':2, '四':3, '五':4, '六':5, '七':6, '八':7, '九':8 };
        const blackColChars = { '1':0, '2':1, '3':2, '4':3, '5':4, '6':5, '7':6, '8':7, '9':8 };
        const actionChars = ['进', '退', '平'];

        let pieceName = null;
        for (const pn of pieceNames) {
            if (text.startsWith(pn)) { pieceName = pn; break; }
        }
        if (!pieceName) return null;

        let fromCol = -1;
        const fromColChar = text[pieceName.length];
        if (fromColChar in redColChars) {
            fromCol = redColChars[fromColChar];
        } else if (fromColChar in blackColChars) {
            fromCol = blackColChars[fromColChar];
        }
        if (fromCol === -1) return null;

        const actionChar = text[pieceName.length + 1];
        if (!actionChars.includes(actionChar)) return null;

        const targetStr = text.substring(pieceName.length + 2);
        if (!targetStr) return null;

        return { pieceName, fromCol, action: actionChar, target: targetStr };
    }

    // 根据语音指令解析目标位置
    resolveVoiceMove(cmd) {
        if (!cmd) return null;
        const color = this.currentPlayer;
        const isRed = color === 'red';

        // 找到对应棋子
        let piecePos = null;
        let piece = null;
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = this.getPiece(r, c);
                if (p && p.name === cmd.pieceName && p.color === color) {
                    const colMatch = isRed ?
                        (c === cmd.fromCol) :
                        (c === cmd.fromCol);
                    if (colMatch) {
                        piecePos = { row: r, col: c };
                        piece = p;
                        break;
                    }
                }
            }
            if (piecePos) break;
        }
        if (!piecePos) return null;

        const { row: fromRow, col: fromCol } = piecePos;
        let toRow = fromRow, toCol = fromCol;

        const redColReverse = ['九','八','七','六','五','四','三','二','一'];
        const redNums = { '一':1, '二':2, '三':3, '四':4, '五':5, '六':6, '七':7, '八':8, '九':9 };
        const blackNums = { '1':1, '2':2, '3':3, '4':4, '5':5, '6':6, '7':7, '8':8, '9':9 };

        if (cmd.action === '平') {
            let targetCol;
            if (isRed) {
                targetCol = redColReverse.indexOf(cmd.target);
            } else {
                targetCol = parseInt(cmd.target) - 1;
            }
            if (targetCol < 0 || targetCol > 8) return null;
            toCol = targetCol;
            toRow = fromRow;
        } else if (cmd.action === '进') {
            if (piece.type === 'rook' || piece.type === 'cannon' || piece.type === 'king') {
                let steps;
                if (isRed) {
                    steps = redNums[cmd.target] || parseInt(cmd.target);
                } else {
                    steps = blackNums[cmd.target] || parseInt(cmd.target);
                }
                if (!steps) return null;
                if (isRed) {
                    toRow = fromRow - steps;
                    toCol = fromCol;
                } else {
                    toRow = fromRow + steps;
                    toCol = fromCol;
                }
            } else if (piece.type === 'horse' || piece.type === 'advisor' || piece.type === 'pawn') {
                let targetCol;
                if (isRed) {
                    targetCol = redColReverse.indexOf(cmd.target);
                } else {
                    targetCol = parseInt(cmd.target) - 1;
                }
                if (targetCol < 0 || targetCol > 8) return null;
                toCol = targetCol;
                const dc = Math.abs(targetCol - fromCol);
                const dr = (piece.type === 'horse') ? (dc === 2 ? 1 : 2) : 1;
                if (isRed) {
                    toRow = fromRow - dr;
                } else {
                    toRow = fromRow + dr;
                }
            } else if (piece.type === 'elephant') {
                let targetCol;
                if (isRed) {
                    targetCol = redColReverse.indexOf(cmd.target);
                } else {
                    targetCol = parseInt(cmd.target) - 1;
                }
                if (targetCol < 0 || targetCol > 8) return null;
                toCol = targetCol;
                if (isRed) {
                    toRow = fromRow - 2;
                } else {
                    toRow = fromRow + 2;
                }
            }
        } else if (cmd.action === '退') {
            if (piece.type === 'rook' || piece.type === 'cannon' || piece.type === 'king') {
                let steps;
                if (isRed) {
                    steps = redNums[cmd.target] || parseInt(cmd.target);
                } else {
                    steps = blackNums[cmd.target] || parseInt(cmd.target);
                }
                if (!steps) return null;
                if (isRed) {
                    toRow = fromRow + steps;
                } else {
                    toRow = fromRow - steps;
                }
                toCol = fromCol;
            } else if (piece.type === 'horse' || piece.type === 'advisor') {
                let targetCol;
                if (isRed) {
                    targetCol = redColReverse.indexOf(cmd.target);
                } else {
                    targetCol = parseInt(cmd.target) - 1;
                }
                if (targetCol < 0 || targetCol > 8) return null;
                toCol = targetCol;
                const dc = Math.abs(targetCol - fromCol);
                const dr = (piece.type === 'horse') ? (dc === 2 ? 1 : 2) : 1;
                if (isRed) {
                    toRow = fromRow + dr;
                } else {
                    toRow = fromRow - dr;
                }
            }
        }

        if (toRow < 0 || toRow >= 10 || toCol < 0 || toCol >= 9) return null;
        return { fromRow, fromCol, toRow, toCol };
    }

    // ========== 功能1：AI 引擎 ==========

    // 不依赖 selectedPiece 的走棋方法
    movePieceByCoords(fromRow, fromCol, toRow, toCol) {
        if (this.gameOver) {
            return { success: false, message: '游戏已结束，请开始新局' };
        }
        const piece = this.getPiece(fromRow, fromCol);
        if (!piece) return { success: false, message: '起始位置没有棋子' };
        if (piece.color !== this.currentPlayer) return { success: false, message: '不是该方的棋子' };

        if (!this.isValidMove(fromRow, fromCol, toRow, toCol, piece)) {
            return { success: false, message: '不合法的走法' };
        }

        // 检查走棋后是否造成己方被将军
        if (this.wouldBeInCheck(fromRow, fromCol, toRow, toCol, piece.color)) {
            return { success: false, message: '这样走会被将军，不允许' };
        }

        const captured = this.getPiece(toRow, toCol);
        let message = this.describeMove(fromRow, fromCol, toRow, toCol, piece);

        this.board[toRow][toCol] = this.board[fromRow][fromCol];
        this.board[fromRow][fromCol] = null;

        this.moveHistory.push({
            from: { row: fromRow, col: fromCol },
            to: { row: toRow, col: toCol },
            piece: piece,
            captured: captured
        });

        this.currentPlayer = this.currentPlayer === 'red' ? 'black' : 'red';
        if (this.currentPlayer === 'red') this.round++;
        this.selectedPiece = null;

        if (captured) {
            message += `，吃掉${captured.color === 'red' ? '红方' : '黑方'}${captured.name}`;
        }

        // ========== 检查游戏结束 ==========
        if (captured && captured.type === 'king') {
            this.gameOver = true;
            this.winner = piece.color;
            const winnerName = piece.color === 'red' ? '红方' : '黑方';
            message += `。${winnerName}获胜！`;
            return { success: true, message, gameOver: true, winner: piece.color };
        }

        const opponent = this.currentPlayer;
        const opponentMoves = this.getAllMoves(opponent);
        if (opponentMoves.length === 0) {
            this.gameOver = true;
            const inCheck = this.isInCheck(opponent);
            this.winner = inCheck ? (opponent === 'red' ? 'black' : 'red') : (opponent === 'red' ? 'black' : 'red');
            const winnerName = this.winner === 'red' ? '红方' : '黑方';
            const loserName = opponent === 'red' ? '红方' : '黑方';
            if (inCheck) {
                message += `。${loserName}被将杀，${winnerName}获胜！`;
            } else {
                message += `。${loserName}无棋可走（困毙），${winnerName}获胜！`;
            }
            return { success: true, message, gameOver: true, winner: this.winner };
        }

        if (this.isInCheck(opponent)) {
            message += '，将军！';
        }

        return { success: true, message };
    }

    // 将军检测
    isInCheck(color) {
        let kingRow = -1, kingCol = -1;
        const kingName = color === 'red' ? '帅' : '将';
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = this.getPiece(r, c);
                if (p && p.name === kingName && p.color === color) {
                    kingRow = r; kingCol = c; break;
                }
            }
            if (kingRow >= 0) break;
        }
        if (kingRow < 0) return true; // 将不存在=被吃=被将

        const opponent = color === 'red' ? 'black' : 'red';
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = this.getPiece(r, c);
                if (p && p.color === opponent) {
                    if (this.isValidMove(r, c, kingRow, kingCol, p)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    // 获取某方所有合法走法（排除送将的走法）
    getAllMoves(color) {
        const moves = [];
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = this.getPiece(r, c);
                if (p && p.color === color) {
                    for (let tr = 0; tr < 10; tr++) {
                        for (let tc = 0; tc < 9; tc++) {
                            if (this.isValidMove(r, c, tr, tc, p)) {
                                // 排除会造成己方被将军的走法
                                if (!this.wouldBeInCheck(r, c, tr, tc, color)) {
                                    moves.push({ fromRow: r, fromCol: c, toRow: tr, toCol: tc, piece: p });
                                }
                            }
                        }
                    }
                }
            }
        }
        return moves;
    }

    // 棋子价值
    getPieceValue(piece) {
        if (!piece) return 0;
        const values = { king: 10000, rook: 900, cannon: 450, horse: 400, elephant: 120, advisor: 120, pawn: 30 };
        return values[piece.type] || 0;
    }

    // 位置加分
    getPositionBonus(piece, row, col) {
        let bonus = 0;
        if (piece.type === 'pawn') {
            if (piece.color === 'red' && row < 5) bonus += 20;
            if (piece.color === 'black' && row > 4) bonus += 20;
        }
        const centerColBonus = (4 - Math.abs(col - 4)) * 3;
        bonus += centerColBonus;
        if (piece.type === 'horse') {
            bonus += (4 - Math.abs(row - 4.5)) * 2;
        }
        return bonus;
    }

    // 局面评估
    evaluateBoard() {
        let score = 0;
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = this.getPiece(r, c);
                if (p) {
                    const val = this.getPieceValue(p) + this.getPositionBonus(p, r, c);
                    if (p.color === 'red') {
                        score += val;
                    } else {
                        score -= val;
                    }
                }
            }
        }
        return score;
    }

    // 模拟走棋（不修改状态）
    simulateMove(fromRow, fromCol, toRow, toCol) {
        const capturedId = this.board[toRow][toCol];
        const pieceId = this.board[fromRow][fromCol];
        this.board[toRow][toCol] = pieceId;
        this.board[fromRow][fromCol] = null;
        return { capturedId, pieceId };
    }

    // 撤销模拟
    undoSimulate(fromRow, fromCol, toRow, toCol, capturedId) {
        const pieceId = this.board[toRow][toCol];
        this.board[fromRow][fromCol] = pieceId;
        this.board[toRow][toCol] = capturedId;
    }

    // Minimax + Alpha-Beta 剪枝
    minimax(depth, alpha, beta, isMaximizing) {
        if (depth === 0) {
            return { score: this.evaluateBoard() };
        }

        const color = isMaximizing ? 'red' : 'black';
        const moves = this.getAllMoves(color);

        if (moves.length === 0) {
            return { score: isMaximizing ? -99999 : 99999 };
        }

        let bestMove = null;

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of moves) {
                const sim = this.simulateMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
                const evalResult = this.minimax(depth - 1, alpha, beta, false);
                this.undoSimulate(move.fromRow, move.fromCol, move.toRow, move.toCol, sim.capturedId);

                if (evalResult.score > maxEval) {
                    maxEval = evalResult.score;
                    bestMove = move;
                }
                alpha = Math.max(alpha, evalResult.score);
                if (beta <= alpha) break;
            }
            return { score: maxEval, move: bestMove };
        } else {
            let minEval = Infinity;
            for (const move of moves) {
                const sim = this.simulateMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
                const evalResult = this.minimax(depth - 1, alpha, beta, true);
                this.undoSimulate(move.fromRow, move.fromCol, move.toRow, move.toCol, sim.capturedId);

                if (evalResult.score < minEval) {
                    minEval = evalResult.score;
                    bestMove = move;
                }
                beta = Math.min(beta, evalResult.score);
                if (beta <= alpha) break;
            }
            return { score: minEval, move: bestMove };
        }
    }

    // 获取最佳走法
    getBestMove(color) {
        const depth = 3;
        const isMaximizing = color === 'red';
        const result = this.minimax(depth, -Infinity, Infinity, isMaximizing);
        return result.move || null;
    }

    // 获取当前方所有棋子
    getPiecesByColor(color) {
        const pieces = [];
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = this.getPiece(r, c);
                if (p && p.color === color) {
                    pieces.push({ row: r, col: c, piece: p });
                }
            }
        }
        return pieces;
    }

    // 获取棋盘上所有棋子（双方）
    getAllPieces() {
        const pieces = [];
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = this.getPiece(r, c);
                if (p) {
                    pieces.push({ row: r, col: c, piece: p });
                }
            }
        }
        return pieces;
    }
}

// 导出
if (typeof module !== 'undefined') {
    module.exports = ChineseChess;
}
