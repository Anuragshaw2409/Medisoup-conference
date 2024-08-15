
export function generateRoomId() {
    const alphabets = 'abcdefghijklmnopqrstuvwxyz';
    let generatedId = "";
    for (let i = 0; i < 10; i++) {
        if (i == 3 || i == 7)
            generatedId += "-";
        generatedId += alphabets.charAt(generateRandomNumber());
    }
    return generatedId;

    function generateRandomNumber() {
        return Math.floor(Math.random() * 26);
    }
}